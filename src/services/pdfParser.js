/**
 * PDF Parser and Citation Matcher Service
 */

/**
 * Normalizes text lines to find references section header.
 */
const REF_HEADER_REGEX = /^\s*(\d+\.?\s*)?(references|referências|bibliography|bibliografia|referências\s+bibliográficas|obras\s+citadas|referencias)\s*$/i;

/**
 * Section headers that mark the end of the bibliography references.
 */
const END_REF_REGEX = /^\s*(\d+\.?\s*)?(appendix|apêndice|appendices|apêndices|supplementary|suplementar|annex|anexo|anexos|about\s+the\s+author|biographies|biograph|biografia|biografias|conflito\s+de\s+interesses|conflict\s+of\s+interest|declaration\s+of\s+interest)\s*$/i;

/**
 * Page numbers and running header/footer patterns to exclude from bibliography lines.
 */
const PAGE_NUMBER_REGEX = /^\s*\d+\s*$/;
const RUNNING_HEADER_FOOTER_REGEX = /^(?:[A-ZÀ-ÖØ-Þ][a-zA-ZÀ-ÖØ-Þß-ÿ\s.'-]*?(?:\s+et\s+al\.?)?\s+\d+|\d+\s+[A-ZÀ-ÖØ-Þ][a-zA-ZÀ-ÖØ-Þß-ÿ\s.'-]*?(?:\s+et\s+al\.?)?)$/i;

/**
 * Checks if a line is likely the start of a new bibliographic reference.
 * Uses formatting cues typical in academic styling (APA, IEEE, Harvard).
 */
export function isNewReferenceStart(line, prevLine) {
  if (!line) return false;
  const trimmed = line.trim();

  // IEEE style: [1] or 1.
  if (/^\[\d+\]/.test(trimmed)) return true;
  if (/^\d+\b/.test(trimmed)) {
    if (/^\d+\.?\s+[A-ZÀ-ÖØ-Þ]/.test(trimmed)) return true;
  }

  // APA / Harvard style: Capitalized name(s) followed by initials or year
  // e.g. "Silva, A." or "Smith, J. D., & Jones, M." or "Doe, J. (2020)"
  if (/^[A-ZÀ-ÖØ-Þ][a-zA-ZÀ-ÖØ-Þß-ÿ\s'-]+,\s*[A-ZÀ-ÖØ-Þ]\b/.test(trimmed)) {
    if (!prevLine || /[.!?\]]\s*$/.test(prevLine.trim())) {
      return true;
    }
  }

  // Author (Year) start format
  if (/^[A-ZÀ-ÖØ-Þ][a-zA-ZÀ-ÖØ-Þß-ÿ\s'-]+.*?\([12]\d{3}\)/.test(trimmed)) {
    if (!prevLine || /[.!?\]]\s*$/.test(prevLine.trim())) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts and cleans candidate surnames from citation text.
 */
export function extractSurnames(authorStr) {
  if (!authorStr) return [];
  
  // Clean punctuation and remove common citation noise (et al., and, &, connectors, etc.)
  const cleaned = authorStr
    .replace(/\bet\s+al\.?\b/gi, '')
    .replace(/\b(and|de|da|do|e|y)\b/gi, '')
    .replace(/[&;,]/g, ' ');
    
  return cleaned
    .split(/\s+/)
    .map(word => word.replace(/[^a-zA-ZÀ-ÖØ-Þß-ÿ-]/g, '').trim())
    .filter(word => word.length > 1 && /^[A-ZÀ-ÖØ-Þ]/.test(word));
}

/**
 * Parses a selection text to extract citations in (Author, Year) or Author (Year) format.
 * Returns an array of parsed citation objects: { raw, authorPart, year, surnames }
 */
export function parseCitationsFromText(text, citationStyle = 'all') {
  if (!text) return [];
  const citations = [];

  const checkAuthorYear = citationStyle === 'all' || citationStyle === 'author-year' || citationStyle === 'abnt';
  const checkNumeric = citationStyle === 'all' || citationStyle === 'numeric';

  // 1. Parenthetical Citations: (Author, Year) or (Author1; Author2, Year, p. 12)
  if (checkAuthorYear) {
    // 1.1 Parenthetical Citations
    // Matches any parentheses that contain a 4-digit year starting with 1 or 2, and contains at least one capitalized letter (proper noun/surname)
    const parenRegex = /\((?=[^)]*?[A-ZÀ-ÖØ-Þ])([^)]*?\b(?:[12]\d{3}[a-z]?)\b[^)]*?)\)/g;
    let parenMatch;
    while ((parenMatch = parenRegex.exec(text)) !== null) {
      const content = parenMatch[1];
      const parts = content.split(';');
      for (const part of parts) {
        const yearMatch = /\b([12]\d{3}[a-z]?)\b/.exec(part);
        if (yearMatch) {
          const year = yearMatch[1];
          const authorPart = part.substring(0, part.indexOf(year)).replace(/,\s*$/, '').trim();
          if (authorPart.length > 1) {
            const surnames = extractSurnames(authorPart);
            if (surnames.length > 0) {
              citations.push({
                raw: `(${part.trim()})`,
                authorPart,
                year,
                surnames
              });
            }
          }
        }
      }
    }

    // 1.2 Narrative Citations: Author (Year)
    // Matches capitalized names (connected strictly by spaces, commas, & or connectors) followed by a year in parentheses (which may contain page info)
    const narrativeRegex = /\b([A-ZÀ-ÖØ-Þ][a-zA-ZÀ-ÖØ-Þß-ÿ'-]*(?:\s+(?:(?:and|e|y|&)\s+)?[A-ZÀ-ÖØ-Þ][a-zA-ZÀ-ÖØ-Þß-ÿ'-]*|\s*,\s*[A-ZÀ-ÖØ-Þ][a-zA-ZÀ-ÖØ-Þß-ÿ'-]*)*(?:\s+et\s+al\.?)?)\s*\(([12]\d{3}[a-z]?)(?:\s*,\s*[^)]+?)?\)/g;
    let narrativeMatch;
    while ((narrativeMatch = narrativeRegex.exec(text)) !== null) {
      const authorPart = narrativeMatch[1].trim();
      const year = narrativeMatch[2];
      const excludedKeywords = /^(figure|fig|table|tab|page|section|chap|chapter|vol|volume|no|issue)$/i;
      if (authorPart && !excludedKeywords.test(authorPart) && authorPart.split(/\s+/).length <= 6) {
        citations.push({
          raw: `${authorPart} (${year})`,
          authorPart,
          year,
          surnames: extractSurnames(authorPart)
        });
      }
    }
  }

  // 2. Numeric Citations: [1] or [1, 2] or [1-3] or [1, 3-5]
  if (checkNumeric) {
    const numericRegex = /\[\s*(\d+(?:\s*,\s*\d+|\s*-\s*\d+)*)\s*\]/g;
    let numericMatch;
    while ((numericMatch = numericRegex.exec(text)) !== null) {
      const content = numericMatch[1];
      const parts = content.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [startStr, endStr] = trimmed.split('-');
          const start = parseInt(startStr.trim(), 10);
          const end = parseInt(endStr.trim(), 10);
          if (!isNaN(start) && !isNaN(end) && start <= end) {
            for (let i = start; i <= end; i++) {
              citations.push({
                raw: `[${i}]`,
                isNumeric: true,
                number: i,
                label: `[${i}]`
              });
            }
          }
        } else {
          const val = parseInt(trimmed, 10);
          if (!isNaN(val)) {
            citations.push({
              raw: `[${val}]`,
              isNumeric: true,
              number: val,
              label: `[${val}]`
            });
          }
        }
      }
    }
  }

  return citations;
}

/**
 * Searches the list of reference strings to find the best match for a given parsed citation.
 */
export function matchCitationToReference(parsedCitation, references) {
  if (parsedCitation.isNumeric) {
    const { number } = parsedCitation;
    if (number === undefined || references.length === 0) return null;
    
    // Pattern to check if reference starts with [number] or number. or number (ignoring spaces)
    // E.g. "[1]" or "1." or "1 "
    const startPattern = new RegExp(`^\\s*(?:\\[0*${number}\\]|0*${number}\\.\\s+|0*${number}\\s+[A-ZÀ-ÖØ-Þ])`, 'i');
    
    for (const ref of references) {
      if (startPattern.test(ref)) {
        return { reference: ref, score: 100 }; // High confidence match
      }
    }
    
    // Fallback: search for just the bracketed number anywhere in the reference (less confident)
    const fallbackPattern = new RegExp(`\\[${number}\\]`);
    for (const ref of references) {
      if (fallbackPattern.test(ref)) {
        return { reference: ref, score: 50 };
      }
    }
    
    return null;
  }

  const { year, surnames } = parsedCitation;
  if (!year || references.length === 0) return null;

  let bestMatch = null;
  let highestScore = 0;

  for (const ref of references) {
    let score = 0;

    // Check if the reference contains the year (essential)
    const containsYear = ref.includes(year);
    if (!containsYear) continue;

    score += 15; // Base score for matching year

    // Check for surname matches (case-insensitive)
    let surnameMatchCount = 0;
    const refLower = ref.toLowerCase();
    
    for (const surname of surnames) {
      if (refLower.includes(surname.toLowerCase())) {
        score += 10;
        surnameMatchCount++;
      }
    }

    // Penalize if no surnames matched
    if (surnames.length > 0 && surnameMatchCount === 0) {
      continue; 
    }

    // Extra points for matches containing exact author text
    if (parsedCitation.authorPart && refLower.includes(parsedCitation.authorPart.toLowerCase())) {
      score += 8;
    }

    // Update best match
    if (score > highestScore) {
      highestScore = score;
      bestMatch = ref;
    }
  }

  return highestScore >= 25 ? { reference: bestMatch, score: highestScore } : null;
}

/**
 * Scans the entire PDF, identifies the bibliography section, and extracts clean, discrete references.
 */
export async function extractReferences(pdfDoc, onProgress) {
  const numPages = pdfDoc.numPages;
  let referencesStartPage = -1;
  const pageTexts = [];

  // Step 1: Scan all pages to extract text and identify where references start
  for (let i = 1; i <= numPages; i++) {
    if (onProgress) {
      onProgress(i, numPages, 'scanning');
    }
    
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    
    const items = content.items;
    const lines = [];
    
    // Sort items by Y descending (top to bottom)
    const sortedItems = [...items]
      .filter(item => item.str && item.str.trim() !== '')
      .sort((a, b) => b.transform[5] - a.transform[5]);
      
    // Group items that are at approximately the same Y position (handles formatting shifts)
    let currentLineY = null;
    let currentLineItems = [];
    const Y_TOLERANCE = 3.5; // points
    
    for (const item of sortedItems) {
      const y = item.transform[5];
      if (currentLineY === null) {
        currentLineY = y;
        currentLineItems.push(item);
      } else if (Math.abs(currentLineY - y) <= Y_TOLERANCE) {
        currentLineItems.push(item);
      } else {
        // Sort items in the completed line by X position (left to right)
        currentLineItems.sort((a, b) => a.transform[4] - b.transform[4]);
        lines.push(currentLineItems.map(item => item.str).join(' '));
        
        currentLineY = y;
        currentLineItems = [item];
      }
    }
    
    if (currentLineItems.length > 0) {
      currentLineItems.sort((a, b) => a.transform[4] - b.transform[4]);
      lines.push(currentLineItems.map(item => item.str).join(' '));
    }
    
    const pageText = lines.join('\n');
    pageTexts.push(pageText);

    // Look for references section header on this page
    if (referencesStartPage === -1) {
      for (const line of lines) {
        if (REF_HEADER_REGEX.test(line.trim())) {
          referencesStartPage = i;
          break;
        }
      }
    }
  }

  // Fallback: if header not found, use last 5 pages
  if (referencesStartPage === -1) {
    referencesStartPage = Math.max(1, numPages - 4);
  }

  // Step 2: Combine text from start page to the end, checking for end-of-references markers
  const referenceSectionLines = [];
  let reachedEnd = false;

  for (let i = referencesStartPage - 1; i < numPages; i++) {
    if (reachedEnd) break;
    const lines = pageTexts[i].split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (END_REF_REGEX.test(trimmed)) {
        reachedEnd = true;
        break;
      }
      // Skip running headers/footers and page numbers
      if (RUNNING_HEADER_FOOTER_REGEX.test(trimmed) || PAGE_NUMBER_REGEX.test(trimmed)) {
        continue;
      }
      referenceSectionLines.push(line);
    }
  }
  const combinedText = referenceSectionLines.join('\n');

  // Slice combinedText to start exactly after the references header
  let cleanText = combinedText;
  const headerMatch = combinedText.match(new RegExp(REF_HEADER_REGEX.source, 'i'));
  if (headerMatch) {
    const headerIndex = combinedText.indexOf(headerMatch[0]);
    cleanText = combinedText.substring(headerIndex + headerMatch[0].length);
  }

  // Step 3: Segment combined text into individual references
  // Split using a positive lookahead for reference starting formats at the start of a line
  const rawReferences = cleanText.split(/\n(?=\[\d+\]|\d+\.\s+[A-ZÀ-ÖØ-Þ]|[A-ZÀ-ÖØ-Þ][a-zA-ZÀ-ÖØ-Þß-ÿ'-]+,\s*[A-ZÀ-ÖØ-Þ][a-zA-ZÀ-ÖØ-Þß-ÿ'-]*\b|[A-ZÀ-ÖØ-Þ][a-zA-ZÀ-ÖØ-Þß-ÿ\s&.,'-]{1,100}\s*\([12]\d{3}\))/);

  const referencesList = [];
  for (let ref of rawReferences) {
    let cleaned = ref.trim().replace(/\s+/g, ' ');
    // Skip if empty or matches references header
    if (!cleaned || REF_HEADER_REGEX.test(cleaned) || cleaned.length < 5) {
      continue;
    }
    referencesList.push(cleaned);
  }

  return {
    references: referencesList,
    startPage: referencesStartPage,
    pageTexts: pageTexts
  };
}

/**
 * Reflows lines of text from a PDF page into continuous paragraphs.
 * Removes unnecessary line breaks while preserving headings, lists, and empty line breaks.
 */
export function reflowText(text) {
  if (!text) return '';
  
  const lines = text.split('\n');
  const paragraphs = [];
  let currentParagraph = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === '') {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' '));
        currentParagraph = [];
      }
      continue;
    }

    // Heuristics for lines that should remain standalone:
    // 1. Lists: starts with bullet, dash, or numbers like "1." or "[1]"
    const isListItem = /^(?:[•\-*]|\[\d+\]|\d+\.\s)/.test(line);
    
    // 2. Short headings: short lines that start with capital letters/digits and don't end in typical sentence enders.
    // We allow a larger limit (90 chars instead of 50) if the line is in ALL CAPS or starts with a section number (e.g. 3.2 or 3.2.1)
    const isAllCaps = line === line.toUpperCase() && /[A-ZÀ-ÖØ-Þ]/.test(line);
    const startsWithSectionNumber = /^\d+(?:\.\d+)+\s+[A-ZÀ-ÖØ-Þ]/.test(line);
    const maxLength = (isAllCaps || startsWithSectionNumber) ? 90 : 50;
    const isHeading = line.length < maxLength && !/[.!?:]\s*$/.test(line) && /^[0-9A-ZÀ-ÖØ-Þ]/.test(line);

    if (isListItem || isHeading) {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' '));
        currentParagraph = [];
      }
      paragraphs.push(line);
      continue;
    }

    // 3. Sentence ender on a short line (often indicates end of a paragraph)
    const prevLine = currentParagraph[currentParagraph.length - 1];
    if (prevLine && /[.!?:]\s*$/.test(prevLine.trim()) && prevLine.trim().length < 40) {
      paragraphs.push(currentParagraph.join(' '));
      currentParagraph = [line];
      continue;
    }

    currentParagraph.push(line);
  }

  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '));
  }

  return paragraphs.join('\n\n');
}
