# SciNAV — PDF Navigator & Citation Matcher

O **SciNAV** é uma ferramenta web acadêmica projetada para aumentar a produtividade na leitura de artigos científicos e no cruzamento de referências bibliográficas. Desenvolvida sob uma identidade visual limpa, profissional e livre de distrações, a aplicação funciona 100% de forma local no navegador (preservando a privacidade dos seus arquivos).

---

## 🚀 Principais Funcionalidades

1. **Leitor de Texto Limpo (*Clean Reader*):**
   - Extrai o texto corrido do PDF e faz o *reflow* automático das quebras de linha para uma leitura fluida.
   - Permite personalizar a **família de fonte** (Sans-serif, Serif, Monospace, Georgia, Times New Roman) e o **tamanho do texto** (12px a 24px).
   - Salva suas preferências de leitura automaticamente no navegador (`localStorage`).
2. **Visualização do PDF Original:**
   - Alternância rápida para a renderização fiel do PDF original com controles de zoom e navegação.
3. **Cruzador de Citações Inteligente:**
   - Detecta e destaca citações acadêmicas no texto.
   - Ao selecionar um trecho ou clicar em uma citação destacada, busca e cruza instantaneamente com a referência bibliográfica correspondente.
   - Permite editar o texto da referência, vinculá-la manualmente, adicionar novas referências por digitação livre ou excluir referências que não deseja usar.
4. **Gerador de Resumo Acadêmico:**
   - Aba dedicada que reúne todas as citações e notas que você salvou.
   - Apresenta uma **Barra de Resumos** com o total de citações salvas, número de fontes e o intervalo de páginas citado.
   - Geração e cópia instantânea de citações formatadas em estilos acadêmicos:
     - **ABNT:** Exemplo: `"[Trecho citado]" (SILVA, 2019, p. 12)`
     - **APA:** Exemplo: `"[Trecho citado]" (Silva, 2019, p. 12)`
5. **Modo Tela Cheia (Fullscreen):**
   - Permite expandir o leitor ou a tela de resumo para ocupar 100% da tela física do dispositivo.
6. **Modo Escuro (Dark Mode):**
   - Interface adaptável com tema escuro e claro de alto contraste e baixa fadiga ocular.

---

## 🛠️ Tecnologias Utilizadas

- **Framework:** React + Vite
- **Estilização:** Tailwind CSS (v4)
- **Manipulação de PDFs:** PDF.js (Mozilla)
- **Ícones:** Lucide React

---

## 💻 Como Executar Localmente

### Pré-requisitos
Você precisará ter o [Node.js](https://nodejs.org/) instalado em sua máquina.

1. **Clonar o Repositório:**
   ```bash
   git clone <url-do-repositorio>
   cd SciNAV
   ```

2. **Instalar Dependências:**
   ```bash
   npm install
   ```

3. **Iniciar o Servidor de Desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse a aplicação em: [http://localhost:5173/](http://localhost:5173/)

4. **Compilar para Produção (Build):**
   ```bash
   npm run build
   ```
   Os arquivos finais otimizados serão gerados na pasta `/dist`.
