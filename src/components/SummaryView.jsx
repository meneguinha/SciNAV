import { useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { 
  Clipboard, ClipboardCheck, Trash2, BookOpen
} from 'lucide-react';

export default function SummaryView() {
  const { savedCitations, deleteCitation, clearAllCitations, addToast } = useNavigation();
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Copy individual citation to clipboard (Standard: "Snippet" Reference)
  const handleCopyIndividual = (id, snippet, referenceText) => {
    const textToCopy = `"${snippet}"\n${referenceText}`;
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        setCopiedId(id);
        addToast('Citação copiada para a área de transferência!', 'success');
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch((err) => {
        console.error('Falha ao copiar:', err);
        addToast('Erro ao copiar citação.', 'error');
      });
  };

  // Copy all citations combined
  const handleCopyAll = () => {
    if (savedCitations.length === 0) return;

    const formattedText = savedCitations
      .map(c => {
        const citationRefs = c.references || [
          { citationText: c.citationText, referenceText: c.referenceText }
        ];
        const refsText = citationRefs.map(r => r.referenceText).join('\n');
        return `"${c.snippet}"\n${refsText}`;
      })
      .join('\n\n');

    navigator.clipboard.writeText(formattedText)
      .then(() => {
        setCopiedAll(true);
        addToast('Todas as referências copiadas com sucesso!', 'success');
        setTimeout(() => setCopiedAll(false), 2000);
      })
      .catch((err) => {
        console.error('Falha ao copiar:', err);
        addToast('Erro ao copiar referências.', 'error');
      });
  };

  // Calculations for Summary Bar metrics
  const numCitations = savedCitations.length;
  const numSources = new Set(savedCitations.map(c => c.docName)).size;
  
  const pages = savedCitations.map(c => c.page).filter(p => typeof p === 'number');
  let pageRange = '-';
  if (pages.length > 0) {
    const minPage = Math.min(...pages);
    const maxPage = Math.max(...pages);
    pageRange = minPage === maxPage ? `p. ${minPage}` : `p. ${minPage}-${maxPage}`;
  }

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-6">
      
      {/* Title & Global Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-[22px] font-medium text-slate-800 dark:text-slate-100">
          Resumo de citações
        </h2>
        {savedCitations.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAll}
              className="border-[0.5px] border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[13px] px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedAll ? (
                <>
                  <ClipboardCheck className="w-4 h-4 text-[#3B6D11]" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Clipboard className="w-4 h-4 text-slate-400" />
                  <span>Copiar tudo</span>
                </>
              )}
            </button>
            <button
              onClick={clearAllCitations}
              className="border-[0.5px] border-slate-200 dark:border-slate-800 hover:border-rose-200 hover:text-rose-600 dark:hover:border-rose-900/60 dark:hover:text-rose-400 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 text-[13px] px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-slate-400" />
              <span>Limpar tudo</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary Bar */}
      <div className="bg-slate-100/70 dark:bg-slate-900/50 p-4 rounded-xl flex items-center justify-around text-center border-0 select-none">
        <div>
          <div className="text-[22px] font-medium text-slate-800 dark:text-slate-100">
            {numCitations}
          </div>
          <div className="text-[12px] text-slate-500 mt-0.5">
            nº de citações
          </div>
        </div>
        <div className="h-8 w-[0.5px] bg-slate-200 dark:bg-slate-800" />
        <div>
          <div className="text-[22px] font-medium text-slate-800 dark:text-slate-100">
            {numSources}
          </div>
          <div className="text-[12px] text-slate-500 mt-0.5">
            nº de fontes
          </div>
        </div>
        <div className="h-8 w-[0.5px] bg-slate-200 dark:bg-slate-800" />
        <div>
          <div className="text-[22px] font-medium text-slate-800 dark:text-slate-100">
            {pageRange}
          </div>
          <div className="text-[12px] text-slate-500 mt-0.5">
            intervalo de páginas
          </div>
        </div>
      </div>

      {/* Citations List */}
      {savedCitations.length === 0 ? (
        <div className="glass-panel rounded-xl p-16 text-center">
          <BookOpen className="w-12 h-12 text-slate-400 dark:text-slate-700 mx-auto mb-4 stroke-1" />
          <h3 className="text-[22px] font-medium text-slate-800 dark:text-slate-350">
            Nenhuma citação salva
          </h3>
          <p className="text-[15px] text-slate-500 font-normal mt-2 max-w-sm mx-auto">
            Vá para a aba "Leitor", selecione um trecho de texto no PDF e vincule-o a uma referência bibliográfica para salvá-la aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-[13px] font-medium tracking-wider text-slate-400 dark:text-slate-500 uppercase">
            Citações extraídas
          </div>

          <div className="space-y-4">
            {savedCitations.map((citation) => {
              const citationRefs = citation.references || [
                { citationText: citation.citationText, referenceText: citation.referenceText }
              ];
              
              return (
                <div 
                  key={citation.id} 
                  className="glass-card rounded-xl p-[1rem_1.25rem] space-y-4"
                >
                  
                  {/* Quoted Section */}
                  <blockquote className="border-l-[2.5px] border-[#3B6D11] pl-3 text-[15px] leading-[1.65] text-slate-800 dark:text-slate-200 font-normal font-sans">
                    "{citation.snippet}"
                  </blockquote>
  
                  {/* Reference line right below quote */}
                  <div className="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400 select-none">
                    <span className="bg-[#EAF3DE] text-[#3B6D11] px-2 py-0.5 rounded text-[12px] font-medium">
                      p. {citation.page}
                    </span>
                    {citation.docName && (
                      <span className="italic truncate max-w-md" title={citation.docName}>
                        {citation.docName}
                      </span>
                    )}
                  </div>
  
                  {/* Full Bibliography Reference */}
                  <div className="space-y-3 border-t-[0.5px] border-slate-200 dark:border-slate-800 pt-3">
                    <div className="text-[13px] font-medium tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                      {citationRefs.length > 1 ? 'Referências bibliográficas' : 'Referência bibliográfica'}
                    </div>
                    <div className="space-y-2.5">
                      {citationRefs.map((ref, idx) => (
                        <div key={idx} className="space-y-1">
                          {ref.citationText && 
                           ref.citationText !== '(Citação manual)' && 
                           ref.citationText !== '(Citação do documento)' && (
                            <div className="text-[12px] font-semibold text-[#3B6D11] bg-[#EAF3DE] px-1.5 py-0.2 rounded w-fit font-mono select-none">
                              {ref.citationText}
                            </div>
                          )}
                          <div className="text-[13px] text-slate-600 dark:text-slate-350 leading-relaxed font-normal bg-slate-50 dark:bg-slate-950/20 p-3 rounded-lg border-[0.5px] border-slate-200 dark:border-slate-800">
                            {ref.referenceText}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
  
                  {/* Card Actions Footer */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 select-none border-t-[0.5px] border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => {
                        const refsText = citationRefs.map(r => r.referenceText).join('\n');
                        handleCopyIndividual(citation.id, citation.snippet, refsText);
                      }}
                      className="border-[0.5px] border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-[13px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedId === citation.id ? (
                        <ClipboardCheck className="w-4 h-4 text-[#3B6D11]" />
                      ) : (
                        <Clipboard className="w-4 h-4 text-slate-400" />
                      )}
                      <span>{copiedId === citation.id ? 'Copiado!' : 'Copiar'}</span>
                    </button>
  
                    <button
                      onClick={() => deleteCitation(citation.id)}
                      className="border-[0.5px] border-slate-200 dark:border-slate-800 hover:border-rose-200 hover:text-rose-600 dark:hover:border-rose-900/60 dark:hover:text-rose-400 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-500 text-[13px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer sm:ml-auto"
                    >
                      <Trash2 className="w-4 h-4 text-slate-400" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
