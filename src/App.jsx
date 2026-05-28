import React, { useEffect } from 'react';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import PDFLoader from './components/PDFLoader';
import PDFReader from './components/PDFReader';
import SummaryView from './components/SummaryView';
import { 
  FileText, ListCollapse, LogOut, CheckCircle2, 
  XCircle, Info, BookOpen, Sun, Moon, Plus, X,
  Maximize2, Minimize2
} from 'lucide-react';

function AppContent() {
  const { 
    pdfFile, activeTab, setActiveTab, 
    savedCitations, toasts, removeToast,
    theme, setTheme,
    loadedDocuments, activeDocId, switchActiveDoc, closeDoc, loadPdf,
    activeAuthor, activeTitle,
    isFullscreen, setIsFullscreen
  } = useNavigation();

  const handleClosePdf = () => {
    if (confirm('Deseja realmente fechar o documento atual? Suas citações salvas continuarão guardadas no navegador.')) {
      closeDoc(activeDocId);
    }
  };

  const toggleTheme = () => {
    setTheme(t => t === 'light' ? 'dark' : 'light');
  };

  // Exit fullscreen on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* HEADER BAR */}
      {!isFullscreen && (
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-950 border-b-[0.5px] border-slate-200 dark:border-slate-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center space-x-2 shrink-0 select-none">
            <img src="./logo.png" alt="SciNAV Logo" className="w-6 h-6 object-contain" />
            <span className="text-[22px] font-medium text-slate-900 dark:text-white tracking-tight">
              SciNAV
            </span>
          </div>

          {/* Document Metadata (Only visible when document loaded) */}
          {pdfFile && (
            <div className="text-right text-[13px] text-slate-500 dark:text-slate-400 truncate max-w-[280px] sm:max-w-md font-normal">
              {activeAuthor && <span>{activeAuthor} — </span>}
              <span className="italic">{activeTitle}</span>
            </div>
          )}

          {/* Fallback info when no PDF */}
          {!pdfFile && (
            <div className="text-[12px] text-slate-500 dark:text-slate-400 font-normal border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50 px-3 py-1 rounded-full">
              Processamento local
            </div>
          )}
        </div>
      </header>
      )}

      {/* CONTROL & DOCUMENT TABS BAR */}
      {!isFullscreen && loadedDocuments.length > 0 && (
        <div className="bg-white dark:bg-slate-900/40 border-b-[0.5px] border-slate-200 dark:border-slate-900 py-2.5 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            
            {/* Left: Document Selector Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 scroll-smooth shrink-0 max-w-full md:max-w-[60%]">
              {loadedDocuments.map((doc) => {
                const isActive = doc.id === activeDocId;
                return (
                  <div
                    key={doc.id}
                    onClick={() => switchActiveDoc(doc.id)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border-[0.5px] text-[13px] font-normal cursor-pointer transition-colors shrink-0 select-none ${
                      isActive
                        ? 'bg-slate-100 dark:bg-slate-900 text-[#3B6D11] border-[#3B6D11] font-medium'
                        : 'bg-white dark:bg-slate-950/20 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700'
                    }`}
                  >
                    <FileText className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="truncate max-w-[120px] sm:max-w-[180px]" title={doc.name}>
                      {doc.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeDoc(doc.id);
                      }}
                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              
              {/* Inline "+" Button to load another PDF */}
              <label className="flex items-center justify-center py-1.5 px-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-[#3B6D11] hover:border-[#3B6D11] bg-white dark:bg-slate-950/10 hover:bg-slate-50 dark:hover:bg-slate-900/30 cursor-pointer text-[13px] font-normal transition-colors shrink-0 select-none">
                <Plus className="w-4 h-4 mr-1 text-slate-400" />
                <span>Adicionar PDF</span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      loadPdf(e.target.files[0]);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {/* Right: Navigation & Actions */}
            <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
              {/* Navigation Tabs */}
              {pdfFile && (
                <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-950/50 p-1 rounded-lg border-[0.5px] border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => setActiveTab('reader')}
                    className={`flex items-center space-x-1.5 px-3.5 py-1 rounded-md text-[13px] font-normal transition-colors cursor-pointer ${
                      activeTab === 'reader'
                        ? 'bg-white dark:bg-slate-900 text-[#3B6D11] border-[0.5px] border-slate-200 dark:border-slate-800 font-medium'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    <span>Leitor</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex items-center space-x-1.5 px-3.5 py-1 rounded-md text-[13px] font-normal transition-colors relative cursor-pointer ${
                      activeTab === 'summary'
                        ? 'bg-white dark:bg-slate-900 text-[#3B6D11] border-[0.5px] border-slate-200 dark:border-slate-800 font-medium'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-205'
                    }`}
                  >
                    <ListCollapse className="w-4 h-4 text-slate-400" />
                    <span>Resumo</span>
                    {savedCitations.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-[#3B6D11] text-white text-[10px] font-medium px-1.5 py-0.2 rounded-full min-w-[16px] h-4 flex items-center justify-center">
                        {savedCitations.length}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* Theme Selector and Actions */}
              <div className="flex items-center space-x-2">
                {/* Fullscreen toggle (available for reader and summary) */}
                {pdfFile && (
                  <button
                    onClick={() => setIsFullscreen(f => !f)}
                    className="p-1.5 rounded-lg border-[0.5px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-slate-350 dark:hover:border-slate-700 transition-colors cursor-pointer"
                    title={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                )}
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-lg border-[0.5px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-slate-350 dark:hover:border-slate-700 transition-colors cursor-pointer"
                  title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
                >
                  {theme === 'light' ? (
                    <Moon className="w-4 h-4" />
                  ) : (
                    <Sun className="w-4 h-4" />
                  )}
                </button>

                {pdfFile && (
                  <button
                    onClick={handleClosePdf}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg border-[0.5px] border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900 transition-colors text-[13px] font-normal cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-slate-400" />
                    <span>Fechar PDF</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE */}
      <main className={isFullscreen
        ? 'fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950 flex flex-col'
        : 'flex-1 max-w-7xl w-full mx-auto px-6 py-6 relative'
      }>
        {/* Floating exit fullscreen button */}
        {isFullscreen && (
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#3B6D11] hover:border-[#3B6D11]/50 transition-colors text-[12px] font-medium shadow-sm cursor-pointer select-none"
            title="Sair da tela cheia (Esc)"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        )}
        {!pdfFile ? (
          <PDFLoader />
        ) : activeTab === 'reader' ? (
          <div className={isFullscreen ? 'flex-1 min-h-0 px-4 pb-4 pt-10' : 'h-full'}>
            <PDFReader />
          </div>
        ) : (
          <div className={isFullscreen ? 'flex-1 min-h-0 px-4 pb-4 pt-10 overflow-y-auto' : ''}>
            <SummaryView />
          </div>
        )}
      </main>

      {/* FLOATING TOASTS PANEL */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-lg border-[0.5px] flex items-start gap-3 pointer-events-auto animate-slide-in ${
              toast.type === 'error'
                ? 'border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20'
                : toast.type === 'info'
                ? 'border-slate-200 bg-slate-100/90 dark:border-slate-800 dark:bg-slate-900'
                : 'border-[#3B6D11]/30 bg-[#EAF3DE]/40 dark:border-[#3B6D11]/45 dark:bg-slate-900'
            }`}
          >
            {/* Status Icons */}
            {toast.type === 'error' ? (
              <XCircle className="w-4.5 h-4.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            ) : toast.type === 'info' ? (
              <Info className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4.5 h-4.5 text-[#3B6D11] shrink-0 mt-0.5" />
            )}

            <div className="flex-1">
              <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200">
                {toast.type === 'error' ? 'Erro' : toast.type === 'info' ? 'Informação' : 'Sucesso'}
              </p>
              <p className="text-[13px] text-slate-600 dark:text-slate-400 font-normal mt-0.5 leading-normal">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-300 transition-colors p-0.5 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <NavigationProvider>
      <AppContent />
    </NavigationProvider>
  );
}
