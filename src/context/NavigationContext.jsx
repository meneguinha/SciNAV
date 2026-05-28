/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { extractReferences } from '../services/pdfParser';

// Configure the PDF.js Web Worker using Vite's asset URL resolver
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const NavigationContext = createContext(null);

export function NavigationProvider({ children }) {
  const [loadedDocuments, setLoadedDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);

  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.5);
  const [references, setReferences] = useState([]);
  const [referencesStartPage, setReferencesStartPage] = useState(-1);
  const [pdfPagesText, setPdfPagesText] = useState([]);
  const [savedCitations, setSavedCitations] = useState(() => {
    const saved = localStorage.getItem('scinav_citations');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState('reader');
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('scinav_theme');
    return saved ? saved : 'light';
  });

  // Apply theme to document element
  useEffect(() => {
    localStorage.setItem('scinav_theme', theme);
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Citation Style selection ('all', 'author-year', 'abnt', 'numeric')
  const [citationStyle, setCitationStyle] = useState(() => {
    const saved = localStorage.getItem('scinav_citation_style');
    return saved ? saved : 'all';
  });

  useEffect(() => {
    localStorage.setItem('scinav_citation_style', citationStyle);
  }, [citationStyle]);
  
  // Parsing status states
  const [isParsing, setIsParsing] = useState(false);
  const [parsingProgress, setParsingProgress] = useState({ current: 0, total: 0, stage: 'idle' });
  
  // Custom toast state
  const [toasts, setToasts] = useState([]);

  // Fullscreen reader mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Persist citations to localStorage
  useEffect(() => {
    localStorage.setItem('scinav_citations', JSON.stringify(savedCitations));
  }, [savedCitations]);

  // Toast helper
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Load and Parse PDF
  const loadPdf = useCallback(async (file) => {
    try {
      setIsParsing(true);
      setParsingProgress({ current: 0, total: 0, stage: 'loading' });
      
      const fileUrl = URL.createObjectURL(file);
      
      // Load document
      const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
      const doc = await loadingTask.promise;
      
      setParsingProgress({ current: 0, total: doc.numPages, stage: 'scanning' });
      
      // Silently scan and parse bibliography references from last pages
      const { references: parsedRefs, startPage, pageTexts } = await extractReferences(doc, (current) => {
        setParsingProgress(prev => ({ ...prev, current }));
      });
      
      // Extract metadata
      let docAuthor = 'Autor desconhecido';
      let docTitle = file.name.replace(/\.[^/.]+$/, ""); // remove extension
      try {
        const meta = await doc.getMetadata();
        if (meta && meta.info) {
          if (meta.info.Author) {
            docAuthor = meta.info.Author;
          }
          if (meta.info.Title) {
            docTitle = meta.info.Title;
          }
        }
      } catch (e) {
        console.error("Error reading metadata:", e);
      }

      // Clean author name: extract surname or limit length
      let cleanAuthor = docAuthor.trim();
      if (cleanAuthor.length > 25) {
        const commaOrSemi = /[,;]/.exec(cleanAuthor);
        if (commaOrSemi) {
          cleanAuthor = cleanAuthor.substring(0, commaOrSemi.index).trim();
        }
        if (cleanAuthor.length > 25) {
          cleanAuthor = cleanAuthor.substring(0, 22) + '...';
        }
      }

      let cleanTitle = docTitle.trim();
      if (cleanTitle.length > 40) {
        cleanTitle = cleanTitle.substring(0, 37) + '...';
      }

      const newDocId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
      const newDocObj = {
        id: newDocId,
        name: file.name,
        file: file,
        doc: doc,
        numPages: doc.numPages,
        currentPage: 1,
        zoom: 1.5,
        references: parsedRefs,
        referencesStartPage: startPage,
        pdfPagesText: pageTexts,
        author: cleanAuthor,
        title: cleanTitle,
        fullAuthor: docAuthor.trim(),
        fullTitle: docTitle.trim()
      };

      setLoadedDocuments(prev => {
        let updated = prev;
        if (activeDocId) {
          updated = prev.map(d => {
            if (d.id === activeDocId) {
              return { ...d, currentPage, zoom };
            }
            return d;
          });
        }
        return [...updated, newDocObj];
      });

      setPdfFile(file);
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);
      setZoom(1.5);
      setReferences(parsedRefs);
      setReferencesStartPage(startPage);
      setPdfPagesText(pageTexts);
      setActiveDocId(newDocId);

      setIsParsing(false);
      
      addToast(
        `PDF carregado com sucesso! Encontradas ${parsedRefs.length} referências na página ${startPage}.`,
        'success'
      );
      
      // Cleanup Object URL
      URL.revokeObjectURL(fileUrl);
    } catch (error) {
      console.error('Error loading PDF:', error);
      setIsParsing(false);
      addToast(`Erro ao carregar PDF: ${error.message || 'Erro desconhecido'}`, 'error');
    }
  }, [activeDocId, currentPage, zoom, addToast]);

  // Switch active document focus
  const switchActiveDoc = useCallback((newDocId) => {
    if (newDocId === activeDocId) return;

    // 1. Save current active document state
    if (activeDocId) {
      setLoadedDocuments(prev => prev.map(d => {
        if (d.id === activeDocId) {
          return { ...d, currentPage, zoom };
        }
        return d;
      }));
    }

    // 2. Load target document state
    const targetDoc = loadedDocuments.find(d => d.id === newDocId);
    if (targetDoc) {
      setPdfFile(targetDoc.file);
      setPdfDoc(targetDoc.doc);
      setNumPages(targetDoc.numPages);
      setCurrentPage(targetDoc.currentPage);
      setZoom(targetDoc.zoom);
      setReferences(targetDoc.references);
      setReferencesStartPage(targetDoc.referencesStartPage);
      setPdfPagesText(targetDoc.pdfPagesText);
      setActiveDocId(newDocId);
    }
  }, [activeDocId, loadedDocuments, currentPage, zoom]);

  // Close and remove document
  const closeDoc = useCallback((docId) => {
    const remainingDocs = loadedDocuments.filter(d => d.id !== docId);
    setLoadedDocuments(remainingDocs);

    if (activeDocId === docId) {
      if (remainingDocs.length > 0) {
        const nextDoc = remainingDocs[0];
        setPdfFile(nextDoc.file);
        setPdfDoc(nextDoc.doc);
        setNumPages(nextDoc.numPages);
        setCurrentPage(nextDoc.currentPage);
        setZoom(nextDoc.zoom);
        setReferences(nextDoc.references);
        setReferencesStartPage(nextDoc.referencesStartPage);
        setPdfPagesText(nextDoc.pdfPagesText);
        setActiveDocId(nextDoc.id);
      } else {
        setPdfFile(null);
        setPdfDoc(null);
        setNumPages(0);
        setCurrentPage(1);
        setZoom(1.5);
        setReferences([]);
        setReferencesStartPage(-1);
        setPdfPagesText([]);
        setActiveDocId(null);
      }
    }
  }, [activeDocId, loadedDocuments]);

  // Save Citation Match
  const saveCitation = useCallback((snippet, arg2, arg3) => {
    let finalRefs = [];
    if (Array.isArray(arg2)) {
      finalRefs = arg2;
    } else {
      // Legacy style: saveCitation(snippet, citationText, referenceText)
      finalRefs = [{ citationText: arg2 || '(Citação)', referenceText: arg3 }];
    }

    const isDuplicate = savedCitations.some(
      c => c.snippet === snippet && 
           (c.referenceText === arg3 || JSON.stringify(c.references) === JSON.stringify(finalRefs))
    );

    if (isDuplicate) {
      addToast('Esta citação já está salva no seu resumo.', 'info');
      return;
    }

    const newCitation = {
      id: Date.now() + Math.random().toString(36).substring(2, 9),
      snippet,
      page: currentPage,
      docName: pdfFile ? pdfFile.name : 'Documento',
      timestamp: new Date().toISOString(),
      references: finalRefs
    };

    setSavedCitations(prev => [newCitation, ...prev]);
    addToast(`Citação salva com ${finalRefs.length} referência(s)!`, 'success');
  }, [currentPage, pdfFile, savedCitations, addToast]);

  // Delete Citation
  const deleteCitation = useCallback((id) => {
    setSavedCitations(prev => prev.filter(c => c.id !== id));
    addToast('Citação removida.', 'info');
  }, [addToast]);

  // Clear all Citations
  const clearAllCitations = useCallback(() => {
    setSavedCitations([]);
    addToast('Todas as citações salvas foram limpas.', 'info');
  }, [addToast]);

  const activeDoc = loadedDocuments.find(d => d.id === activeDocId) || null;
  const activeAuthor = activeDoc ? activeDoc.author : '';
  const activeTitle = activeDoc ? activeDoc.title : '';
  const activeFullAuthor = activeDoc ? (activeDoc.fullAuthor || activeDoc.author) : '';
  const activeFullTitle = activeDoc ? (activeDoc.fullTitle || activeDoc.title) : '';

  const activeDocDefaultRef = activeFullAuthor && activeFullAuthor !== 'Autor desconhecido'
    ? `${activeFullAuthor} — ${activeFullTitle}`
    : activeFullTitle;

  const activeDocumentReference = activeDoc && activeDoc.customDocumentReference
    ? activeDoc.customDocumentReference
    : activeDocDefaultRef;

  const updateActiveDocReference = useCallback((newRef) => {
    if (!activeDocId) return;

    // Find the active doc's filename to match against saved citations
    const activeDoc = loadedDocuments.find(d => d.id === activeDocId);
    const activeDocName = activeDoc ? activeDoc.name : null;

    setLoadedDocuments(prev => prev.map(d => {
      if (d.id === activeDocId) {
        return { ...d, customDocumentReference: newRef };
      }
      return d;
    }));

    if (activeDocName) {
      setSavedCitations(prev => prev.map(citation => {
        // If the citation belongs to the active document
        if (citation.docName === activeDocName) {
          // Map over its references list
          const updatedRefs = (citation.references || []).map(ref => {
            if (ref.citationText === '(Citação do documento)') {
              return { ...ref, referenceText: newRef };
            }
            return ref;
          });
          return { ...citation, references: updatedRefs };
        }
        return citation;
      }));
    }
  }, [activeDocId, loadedDocuments]);

  return (
    <NavigationContext.Provider
      value={{
        pdfFile,
        pdfDoc,
        numPages,
        currentPage,
        setCurrentPage,
        zoom,
        setZoom,
        references,
        referencesStartPage,
        pdfPagesText,
        savedCitations,
        activeTab,
        setActiveTab,
        theme,
        setTheme,
        citationStyle,
        setCitationStyle,
        isParsing,
        parsingProgress,
        toasts,
        addToast,
        removeToast,
        loadPdf,
        saveCitation,
        deleteCitation,
        clearAllCitations,
        loadedDocuments,
        activeDocId,
        switchActiveDoc,
        closeDoc,
        activeAuthor,
        activeTitle,
        activeFullAuthor,
        activeFullTitle,
        activeDocumentReference,
        updateActiveDocReference,
        isFullscreen,
        setIsFullscreen
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
