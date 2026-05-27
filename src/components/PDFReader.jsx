import { useRef, useEffect, useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { TextLayer } from 'pdfjs-dist';
import { parseCitationsFromText, matchCitationToReference, reflowText } from '../services/pdfParser';
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Search, 
  Link2, BookOpen, AlertCircle,
  FileText, AlignLeft, ChevronDown, Quote
} from 'lucide-react';

/**
 * Extracts the complete sentence surrounding a specific citation.
 */
function getSurroundingSentence(text, citation) {
  const index = text.indexOf(citation);
  if (index === -1) return citation;
  
  // Find start of sentence (previous period followed by space, double newlines, or start of text)
  let start = index;
  while (start > 0) {
    const prevChar = text[start - 1];
    const prevPrevChar = start > 1 ? text[start - 2] : '';
    if (/[.!?]/.test(prevPrevChar) && /\s/.test(prevChar)) {
      break;
    }
    if (prevChar === '\n' && prevPrevChar === '\n') {
      break;
    }
    start--;
  }
  
  // Find end of sentence
  let end = index + citation.length;
  while (end < text.length) {
    const char = text[end];
    const nextChar = end < text.length - 1 ? text[end + 1] : '';
    if (/[.!?]/.test(char) && (nextChar === '' || /\s/.test(nextChar))) {
      end++; // Include punctuation
      break;
    }
    if (char === '\n' && nextChar === '\n') {
      break;
    }
    end++;
  }
  
  return text.substring(start, end).trim().replace(/\s+/g, ' ');
}

const FONT_FAMILIES = {
  sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  georgia: 'Georgia, serif',
  times: '"Times New Roman", Times, serif',
};

export default function PDFReader() {
  const { 
    pdfDoc, numPages, currentPage, setCurrentPage, 
    zoom, setZoom, references, pdfPagesText, saveCitation,
    isFullscreen
  } = useNavigation();

  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const containerRef = useRef(null);

  const [isRendering, setIsRendering] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [linkedRefs, setLinkedRefs] = useState([]);
  
  // Mode selection: 'text' (default) or 'pdf' (canvas)
  const [readerMode, setReaderMode] = useState('text');
  
  // Manual linkage state: holds the citation text key of the link currently being manually resolved
  const [showManualLinker, setShowManualLinker] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRightTab, setActiveRightTab] = useState('match'); // 'match' or 'all_refs'
  const [citationStyle, setCitationStyle] = useState('auto'); // 'auto' | 'abnt' | 'apa' | 'ieee' | 'harvard'
  const [editingRef, setEditingRef] = useState(null);   // citationText being edited
  const [editingText, setEditingText] = useState('');   // current textarea value

  const [textFont, setTextFont] = useState(() => localStorage.getItem('scinav_textFont') || 'sans');
  const [textSize, setTextSize] = useState(() => Number(localStorage.getItem('scinav_textSize')) || 15);

  useEffect(() => {
    localStorage.setItem('scinav_textFont', textFont);
  }, [textFont]);

  useEffect(() => {
    localStorage.setItem('scinav_textSize', textSize.toString());
  }, [textSize]);

  const activeRefsCount = linkedRefs.filter(r => r.referenceText).length;

  // Page rendering effect for PDF canvas mode
  useEffect(() => {
    if (!pdfDoc || readerMode !== 'pdf') return;
    
    let active = true;

    async function renderPage() {
      try {
        setIsRendering(true);
        const page = await pdfDoc.getPage(currentPage);
        if (!active) return;

        const viewport = page.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');

        // Cancel previous render task if running
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        // Handle Retina/high-DPI screens
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";

        const transform = outputScale !== 1 
          ? [outputScale, 0, 0, outputScale, 0, 0] 
          : null;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          transform: transform
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (!active) return;

        // Render Text Layer
        const textContainer = textLayerRef.current;
        if (textContainer) {
          textContainer.innerHTML = '';
          textContainer.style.width = `${viewport.width}px`;
          textContainer.style.height = `${viewport.height}px`;

          const textContent = await page.getTextContent();
          if (!active) return;

          const textLayerInstance = new TextLayer({
            textContentSource: textContent,
            container: textContainer,
            viewport: viewport,
          });

          await textLayerInstance.render();
        }

        setIsRendering(false);
      } catch (err) {
        if (err.name === 'RenderingCancelledException' || err.message?.includes('cancelled')) {
          console.log('Rendering cancelled due to page/zoom change.');
        } else {
          console.error('Error rendering page:', err);
          setIsRendering(false);
        }
      }
    }

    renderPage();

    return () => {
      active = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, currentPage, zoom, readerMode]);

  // Handle keyboard arrow navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (
        activeEl && 
        (activeEl.tagName === 'INPUT' || 
         activeEl.tagName === 'TEXTAREA' || 
         activeEl.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        if (currentPage > 1) {
          e.preventDefault();
          setCurrentPage(currentPage - 1);
          setSelectedText('');
          setLinkedRefs([]);
        }
      } else if (e.key === 'ArrowRight') {
        if (currentPage < numPages) {
          e.preventDefault();
          setCurrentPage(currentPage + 1);
          setSelectedText('');
          setLinkedRefs([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentPage, numPages, setCurrentPage]);

  // Helper to initialize selection and matching
  const initializeSelection = (text) => {
    setSelectedText(text);
    setSearchQuery('');
    setShowManualLinker(null);

    const parsed = parseCitationsFromText(text, citationStyle === 'auto' ? 'all' : citationStyle);
    
    const initialLinks = [];
    if (parsed.length > 0) {
      const seen = new Set();
      for (const cit of parsed) {
        if (seen.has(cit.raw)) continue;
        seen.add(cit.raw);

        const matchResult = matchCitationToReference(cit, references);
        initialLinks.push({
          citationText: cit.raw,
          referenceText: matchResult ? matchResult.reference : null,
          isNumeric: !!cit.isNumeric
        });
      }
      
      const unmatched = initialLinks.filter(l => !l.referenceText);
      if (unmatched.length === 1) {
        setShowManualLinker(unmatched[0].citationText);
      } else {
        setShowManualLinker(null);
      }
    } else {
      // Manual selection placeholder
      initialLinks.push({
        citationText: '(Citação manual)',
        referenceText: null
      });
      setShowManualLinker('(Citação manual)');
    }
    setLinkedRefs(initialLinks);
  };

  // Capture selection on MouseUp (for both modes)
  const handleMouseUp = () => {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (!text) return; 
      initializeSelection(text);
    }, 50);
  };

  // Handles clicking on auto-highlighted citation in Text Mode
  const handleCitationClick = (citationText) => {
    const pageText = pdfPagesText[currentPage - 1] || '';
    const reflowedPageText = reflowText(pageText);
    const snippet = getSurroundingSentence(reflowedPageText, citationText);
    initializeSelection(snippet);
    setActiveRightTab('match');
  };

  const handleLinkReference = (citationText, selectedRef) => {
    setLinkedRefs(prev => prev.map(item => {
      if (item.citationText === citationText) {
        return { ...item, referenceText: selectedRef };
      }
      return item;
    }));
    setShowManualLinker(null);
    setSearchQuery('');
  };

  const handleUnlinkReference = (citationText) => {
    setLinkedRefs(prev => prev.map(item => {
      if (item.citationText === citationText) {
        return { ...item, referenceText: null };
      }
      return item;
    }));
    setShowManualLinker(citationText);
    setSearchQuery('');
  };

  const handleDeleteReference = (citationText) => {
    setLinkedRefs(prev => prev.filter(item => item.citationText !== citationText));
    if (editingRef === citationText) setEditingRef(null);
  };

  const handleStartEdit = (item) => {
    setEditingRef(item.citationText);
    setEditingText(item.referenceText || '');
  };

  const handleSaveEditedReference = (citationText) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;
    setLinkedRefs(prev => prev.map(item =>
      item.citationText === citationText ? { ...item, referenceText: trimmed } : item
    ));
    setEditingRef(null);
    setEditingText('');
  };

  const handleAddManualReference = () => {
    const newKey = `(Citação manual ${linkedRefs.length + 1})`;
    setLinkedRefs(prev => [
      ...prev,
      {
        citationText: newKey,
        referenceText: null
      }
    ]);
    setShowManualLinker(newKey);
    setSearchQuery('');
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= numPages) {
      setCurrentPage(newPage);
      setSelectedText('');
      setLinkedRefs([]);
    }
  };

  // Highlights citations in plain text
  const renderTextWithCitationHighlights = (text) => {
    if (!text) return '';
    
    // Auto-detection using 'all' mode logic via parseCitationsFromText pattern
    const pattern = `(\\((?=[^)]*?[A-ZÀ-ÖØ-Þ])(?:[^)]*?\\b(?:[12]\\d{3}[a-z]?)\\b[^)]*?)\\)|\\b(?:[A-ZÀ-ÖØ-Þ][a-zA-ZÀ-ÖØ-Þß-ÿ\'-]*(?:\\s+(?:(?:and|e|y|&)\\s+)?[A-ZÀ-ÖØ-Þ][a-zA-ZÀ-ÖØ-Þß-ÿ\'-]*|\\s*,\\s*[A-ZÀ-ÖØ-Þ][a-zA-ZÀ-ÖØ-Þß-ÿ\'-]*)*(?:\\s+et\\s+al\\.?)?)\\s*\\((?:[12]\\d{3}[a-z]?)(?:\\s*,\\s*[^)]+?)?\\)|\\[\\s*\\d+(?:(?:\\s*,\\s*\\d+)|(?:\\s*-\\s*\\d+))*\\s*\\])`;
    
    const citationRegex = new RegExp(pattern, 'g');
    const parts = text.split(citationRegex);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <span
            key={index}
            onClick={() => handleCitationClick(part)}
            className="bg-[#3B6D11]/10 text-[#3B6D11] border-b border-dashed border-[#3B6D11]/45 hover:bg-[#3B6D11]/20 hover:text-[#3B6D11]/90 px-1 rounded cursor-pointer transition-colors font-medium select-all"
            title="Clique para cruzar citação instantaneamente"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const filteredReferences = references.filter(ref => 
    ref.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentPageText = pdfPagesText[currentPage - 1] || '';

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${isFullscreen ? 'h-full' : 'h-[calc(100vh-8rem)]'}`}>
      {/* LEFT: PDF Reader Workspace */}
      <div className="lg:col-span-8 flex flex-col glass-panel rounded-xl overflow-hidden">
        
        {/* PDF Reader Toolbar */}
        <div className="bg-slate-100/90 dark:bg-slate-900/60 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 select-none">
          {/* Mode Switcher */}
          <div className="flex items-center space-x-1 bg-slate-200/50 dark:bg-slate-950/50 p-1 rounded-lg border border-slate-300/40 dark:border-slate-800">
            <button
              onClick={() => setReaderMode('text')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md text-[13px] font-normal transition-colors cursor-pointer ${
                readerMode === 'text'
                  ? 'bg-white dark:bg-slate-900 text-[#3B6D11] border-[0.5px] border-slate-200 dark:border-slate-800 font-medium'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <AlignLeft className="w-4 h-4 text-slate-400" />
              <span>Texto limpo</span>
            </button>
            <button
              onClick={() => setReaderMode('pdf')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md text-[13px] font-normal transition-colors cursor-pointer ${
                readerMode === 'pdf'
                  ? 'bg-white dark:bg-slate-900 text-[#3B6D11] border-[0.5px] border-slate-200 dark:border-slate-800 font-medium'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4 text-slate-400" />
              <span>PDF original</span>
            </button>
          </div>

          {/* Page Navigator */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800/80 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="Página anterior"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>
            <span className="text-[13px] font-normal text-slate-700 dark:text-slate-300 min-w-[80px] text-center">
              Pág. {currentPage} de {numPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800/80 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="Próxima página"
            >
              <ChevronRight className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Zoom (only in PDF mode) */}
          {readerMode === 'pdf' ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                title="Diminuir zoom"
              >
                <ZoomOut className="w-4 h-4 text-slate-400" />
              </button>
              <span className="text-[12px] font-normal text-slate-500 w-12 text-center font-mono">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                title="Aumentar zoom"
              >
                <ZoomIn className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-slate-500 select-none">Estilo:</span>
                <select
                  value={citationStyle}
                  onChange={(e) => setCitationStyle(e.target.value)}
                  className="text-[12px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 cursor-pointer outline-none focus:ring-1 focus:ring-[#3B6D11]/40 transition-colors"
                >
                  <option value="auto">Automático</option>
                  <option value="abnt">ABNT</option>
                  <option value="apa">APA</option>
                  <option value="ieee">IEEE</option>
                  <option value="harvard">Harvard</option>
                </select>
              </div>

              <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-800 hidden sm:block" />

              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-slate-500 select-none font-medium">Fonte:</span>
                <select
                  value={textFont}
                  onChange={(e) => setTextFont(e.target.value)}
                  className="text-[12px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 cursor-pointer outline-none focus:ring-1 focus:ring-[#3B6D11]/40 transition-colors"
                >
                  <option value="sans">Sans-serif</option>
                  <option value="serif">Serif</option>
                  <option value="mono">Monospace</option>
                  <option value="georgia">Georgia</option>
                  <option value="times">Times New Roman</option>
                </select>
              </div>

              <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-800 hidden sm:block" />

              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-slate-500 select-none font-medium">Tamanho:</span>
                <select
                  value={textSize}
                  onChange={(e) => setTextSize(Number(e.target.value))}
                  className="text-[12px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 cursor-pointer outline-none focus:ring-1 focus:ring-[#3B6D11]/40 transition-colors"
                >
                  <option value="12">12px</option>
                  <option value="13">13px</option>
                  <option value="14">14px</option>
                  <option value="15">15px (Padrão)</option>
                  <option value="16">16px</option>
                  <option value="18">18px</option>
                  <option value="20">20px</option>
                  <option value="22">22px</option>
                  <option value="24">24px</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Viewport content */}
        {readerMode === 'text' ? (
          /* TEXT MODE (Clean Reader Layout) */
          <div 
            className="flex-1 overflow-auto bg-white dark:bg-slate-950 p-8 select-text"
            onMouseUp={handleMouseUp}
          >
            <div 
              className="max-w-2xl mx-auto text-slate-800 dark:text-slate-300 leading-relaxed"
              style={{
                fontFamily: FONT_FAMILIES[textFont] || FONT_FAMILIES.sans,
                fontSize: `${textSize}px`
              }}
            >
              {currentPageText ? (
                <div className="whitespace-pre-wrap font-normal tracking-wide space-y-4">
                  {renderTextWithCitationHighlights(reflowText(currentPageText))}
                </div>
              ) : (
                <div className="text-slate-500 text-center py-20 flex flex-col items-center select-none">
                  <AlignLeft className="w-10 h-10 text-slate-400 dark:text-slate-700 mb-4 stroke-1 animate-pulse" />
                  <p className="text-[13px] font-normal">Extraindo conteúdo da página...</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* PDF CANVAS MODE */
          <div 
            ref={containerRef}
            className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 p-6 flex justify-center items-start relative select-text"
            onMouseUp={handleMouseUp}
          >
            {isRendering && (
              <div className="absolute inset-0 bg-white/70 dark:bg-slate-950/70 z-50 flex items-center justify-center space-x-3 select-none">
                <div className="w-4 h-4 border-2 border-[#3B6D11] border-t-transparent rounded-full animate-spin" />
                <span className="text-[13px] font-normal text-slate-800 dark:text-slate-300">Renderizando PDF...</span>
              </div>
            )}

            <div className="relative border border-slate-200 dark:border-slate-800 bg-white">
              <canvas ref={canvasRef} />
              <div 
                ref={textLayerRef} 
                className="textLayer" 
              />
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Citations & References Panel */}
      <div className="lg:col-span-4 flex flex-col glass-panel rounded-xl overflow-hidden h-full">
        {/* Toggle tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/30 select-none shrink-0">
          <button
            onClick={() => setActiveRightTab('match')}
            className={`flex-1 py-3 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
              activeRightTab === 'match'
                ? 'border-[#3B6D11] text-[#3B6D11] bg-white dark:bg-slate-900/50 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Cruzador de citações
          </button>
          <button
            onClick={() => setActiveRightTab('all_refs')}
            className={`flex-1 py-3 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
              activeRightTab === 'all_refs'
                ? 'border-[#3B6D11] text-[#3B6D11] bg-white dark:bg-slate-900/50 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Referências ({references.length})
          </button>
        </div>

        {/* Tab Panel Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeRightTab === 'match' ? (
            /* Matcher Tab */
            <div className="space-y-5">
              {!selectedText ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-16 px-4 select-none">
                  <BookOpen className="w-10 h-10 text-slate-400 dark:text-slate-700 mb-4 stroke-1" />
                  <p className="text-[13px] font-medium text-slate-700 dark:text-slate-400 mb-1">Nenhum trecho selecionado</p>
                  <p className="text-[12px] text-slate-500 leading-relaxed max-w-[240px]">
                    Destaque qualquer parte do texto ou clique em uma das citações sublinhadas para cruzar referências.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 animate-slide-in">
                  
                  {/* Selection Snippet */}
                  <div className="space-y-1.5">
                    <span className="text-[13px] font-medium tracking-wider text-slate-400 dark:text-slate-500 uppercase select-none">
                      Trecho selecionado
                    </span>
                    <div className="p-3 bg-slate-55 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-[13px] italic text-slate-800 dark:text-slate-300 max-h-32 overflow-y-auto leading-relaxed">
                      "{selectedText}"
                    </div>
                  </div>

                  {/* Auto Match Results */}
                  <div className="space-y-3.5">
                    <div className="flex items-center space-x-2 text-[#3B6D11] select-none">
                      <Quote className="w-4 h-4" />
                      <span className="text-[13px] font-medium tracking-wider uppercase">Citações e referências</span>
                    </div>

                    {linkedRefs.map((item, idx) => {
                      const isEditing = editingRef === item.citationText;
                      return (
                        <div key={idx} className="p-3 bg-white dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3 animate-slide-in">
                          {/* Card header: citation label + red delete button */}
                          <div className="flex justify-between items-center select-none">
                            <span className="text-[12px] font-bold text-[#3B6D11] bg-[#EAF3DE] px-2 py-0.5 rounded border border-[#3B6D11]/20 font-mono">
                              {item.citationText}
                            </span>
                            <button
                              onClick={() => handleDeleteReference(item.citationText)}
                              title="Excluir referência"
                              className="w-5 h-5 flex items-center justify-center rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                            >
                              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-3.5 h-3.5">
                                <path d="M3 3l10 10M13 3L3 13" />
                              </svg>
                            </button>
                          </div>

                          {/* Reference body */}
                          {item.referenceText && !isEditing ? (
                            <div className="space-y-2">
                              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 text-[13px] leading-relaxed text-slate-700 dark:text-slate-350 max-h-36 overflow-y-auto">
                                {item.referenceText}
                              </div>
                              <button
                                onClick={() => handleStartEdit(item)}
                                className="text-[12px] text-[#3b6d11] hover:text-[#3b6d11]/80 hover:underline cursor-pointer transition-colors select-none"
                              >
                                Editar
                              </button>
                            </div>
                          ) : isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEditedReference(item.citationText); } }}
                                rows={3}
                                className="w-full glass-input px-3 py-2 text-[13px] leading-relaxed outline-none resize-none"
                                autoFocus
                                placeholder="Edite o texto da referência..."
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveEditedReference(item.citationText)}
                                  disabled={!editingText.trim()}
                                  className="flex-1 py-1.5 bg-[#3B6D11] hover:bg-[#3B6D11]/90 disabled:opacity-40 text-white text-[12px] font-medium rounded-lg transition-colors cursor-pointer"
                                >
                                  Salvar edição
                                </button>
                                <button
                                  onClick={() => { setEditingRef(null); setEditingText(''); }}
                                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 text-[12px] font-medium rounded-lg transition-colors cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="text-[13px] text-amber-700 dark:text-amber-400 font-medium flex items-center space-x-1.5 select-none">
                                <AlertCircle className="w-4 h-4" />
                                <span>Não conseguimos cruzar automaticamente.</span>
                              </div>

                              <div className="pt-1.5 space-y-2 border-t border-slate-200/60 dark:border-slate-800">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                                  <input
                                    type="text"
                                    placeholder="Buscar ou digitar referência e apertar Enter..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && searchQuery.trim()) {
                                        e.preventDefault();
                                        handleLinkReference(item.citationText, searchQuery.trim());
                                      }
                                    }}
                                    className="w-full glass-input pl-8 pr-3 py-1.5 text-[13px] outline-none"
                                    autoFocus={showManualLinker === item.citationText}
                                  />
                                </div>
                                <div className="max-h-36 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 bg-slate-50 dark:bg-slate-950">
                                  {filteredReferences.length > 0 ? (
                                    filteredReferences.map((ref, refIdx) => (
                                      <button
                                        key={refIdx}
                                        onClick={() => handleLinkReference(item.citationText, ref)}
                                        className="w-full text-left p-1.5 hover:bg-[#EAF3DE]/30 dark:hover:bg-[#EAF3DE]/10 rounded text-[12px] leading-relaxed text-slate-700 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors font-normal cursor-pointer"
                                      >
                                        {ref}
                                      </button>
                                    ))
                                  ) : (
                                    <div className="text-[12px] text-slate-500 text-center py-2 select-none">
                                      {searchQuery.trim()
                                        ? 'Nenhuma correspondência. Pressione Enter para usar este texto como referência.'
                                        : 'Nenhuma referência encontrada.'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions Area */}
                  <div className="pt-2 space-y-3">
                    <button
                      onClick={handleAddManualReference}
                      className="w-full py-1.5 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[13px] font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer select-none"
                    >
                      <Link2 className="w-4 h-4 text-slate-400" />
                      <span>Adicionar outra referência</span>
                    </button>

                    <button
                      onClick={() => {
                        const activeRefs = linkedRefs.filter(r => r.referenceText);
                        if (activeRefs.length > 0) {
                          saveCitation(selectedText, activeRefs);
                          setSelectedText('');
                          setLinkedRefs([]);
                          window.getSelection()?.removeAllRanges();
                        }
                      }}
                      disabled={activeRefsCount === 0}
                      className="w-full py-2 bg-[#3B6D11] hover:bg-[#3B6D11]/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-medium rounded-lg transition-colors cursor-pointer select-none"
                    >
                      {activeRefsCount > 1 
                        ? `Salvar citação com ${activeRefsCount} referências` 
                        : 'Salvar citação e referência'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* All References Tab */
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar referências..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full glass-input pl-9 pr-4 py-1.5 text-[13px]"
                />
              </div>

              <div className="space-y-2.5">
                {filteredReferences.length > 0 ? (
                  filteredReferences.map((ref, idx) => (
                    <div 
                      key={idx}
                      className="p-3 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 rounded-xl text-[13px] leading-relaxed text-slate-700 dark:text-slate-350 transition-colors font-normal select-text"
                    >
                      <div className="font-mono text-[12px] text-[#3B6D11] font-semibold mb-1 select-none">
                        [{idx + 1}]
                      </div>
                      {ref}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-500 text-[13px] select-none">
                    Nenhuma referência bibliográfica encontrada.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
