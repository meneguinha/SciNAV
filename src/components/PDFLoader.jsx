import { useState, useCallback } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { UploadCloud, FileText, Loader2, BookOpen } from 'lucide-react';

export default function PDFLoader() {
  const { loadPdf, isParsing, parsingProgress } = useNavigation();
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const processFile = useCallback((file) => {
    if (file && file.type === 'application/pdf') {
      setErrorMessage('');
      loadPdf(file);
    } else {
      setErrorMessage('Por favor, envie apenas arquivos PDF.');
    }
  }, [loadPdf]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleChange = useCallback((e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  // Percentage progress for the loading bar
  const percentComplete = parsingProgress.total > 0 
    ? Math.round((parsingProgress.current / parsingProgress.total) * 100) 
    : 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto px-4 py-8 select-none">
      {/* App Headline */}
      <div className="text-center mb-8">
        <h1 className="text-[22px] sm:text-[26px] font-medium mb-3 text-slate-900 dark:text-white leading-tight tracking-tight">
          Navegue por PDFs acadêmicos
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-[15px] font-normal max-w-md mx-auto leading-relaxed">
          Extraia referências bibliográficas instantaneamente selecionando citações no texto. Todo o processamento é feito localmente no seu navegador.
        </p>
      </div>

      {isParsing ? (
        /* Progress / Parsing Card (Flat academic style) */
        <div className="w-full h-80 bg-white dark:bg-slate-900 border-[0.5px] border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center relative overflow-hidden flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-[#3B6D11] animate-spin mx-auto mb-4 shrink-0" />
          
          <h3 className="text-[15px] font-medium text-slate-800 dark:text-slate-100 mb-1 shrink-0">
            Processando PDF
          </h3>
          
          <p className="text-slate-500 dark:text-slate-400 text-[13px] mb-4 max-w-sm mx-auto h-8 flex items-center justify-center shrink-0">
            {parsingProgress.stage === 'loading' 
              ? 'Lendo arquivo da memória local...' 
              : `Varrendo páginas: página ${parsingProgress.current} de ${parsingProgress.total}...`}
          </p>
 
          {/* Progress Bar */}
          <div className="w-full max-w-md bg-slate-100 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden mb-3 border border-slate-200 dark:border-slate-850 shrink-0">
            <div 
              className="bg-[#3B6D11] h-1.5 rounded-full transition-all duration-305 ease-out" 
              style={{ width: `${percentComplete}%` }}
            />
          </div>
          <span className="text-[12px] text-[#3B6D11] font-medium bg-[#EAF3DE] px-2.5 py-0.5 rounded border border-[#3B6D11]/20 shrink-0">
            {percentComplete}% concluído
          </span>
        </div>
      ) : (
        /* Drag and Drop Zone (Flat academic style) */
        <div className="w-full">
          <label 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center w-full h-80 border-[0.5px] border-dashed rounded-xl cursor-pointer transition-colors duration-250 ${
              isDragActive 
                ? 'border-[#3B6D11] bg-[#EAF3DE]/20 dark:bg-[#EAF3DE]/5' 
                : 'border-slate-350 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-450 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-850 mb-4">
                <UploadCloud className="w-8 h-8 text-[#3B6D11]" />
              </div>
              <p className="mb-2 text-[15px] font-medium text-slate-850 dark:text-slate-200">
                Arraste seu PDF aqui ou <span className="text-[#3B6D11] underline decoration-[#3B6D11]/30 decoration-2">procure localmente</span>
              </p>
              <p className="text-[13px] text-slate-500 font-normal">
                Apenas documentos PDF (.pdf) até 100MB
              </p>
            </div>
            
            <input 
              type="file" 
              className="hidden" 
              accept="application/pdf"
              onChange={handleChange} 
            />
          </label>

          {errorMessage && (
            <p className="mt-3 text-[13px] text-rose-600 dark:text-rose-400 text-center font-medium bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/20 py-2 px-4 rounded-lg">
              {errorMessage}
            </p>
          )}

          {/* Key Features Quick Guide */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 w-full">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border-[0.5px] border-slate-205 dark:border-slate-800/80 flex items-start space-x-4">
              <BookOpen className="w-6 h-6 text-[#3B6D11] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-[15px] text-slate-850 dark:text-slate-200 mb-1">
                  Zero servidor
                </h4>
                <p className="text-[13px] text-slate-500 leading-relaxed font-normal">
                  Seus dados nunca saem da sua máquina. O processamento e renderização do PDF acontecem 100% no seu navegador de forma segura.
                </p>
              </div>
            </div>
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border-[0.5px] border-slate-205 dark:border-slate-800/80 flex items-start space-x-4">
              <FileText className="w-6 h-6 text-[#3B6D11] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-[15px] text-slate-850 dark:text-slate-200 mb-1">
                  Destaques inteligentes
                </h4>
                <p className="text-[13px] text-slate-500 leading-relaxed font-normal">
                  Selecione citações como "(Silva, 2019)" com o mouse e o leitor cruzará instantaneamente com a lista completa de referências bibliográficas.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
