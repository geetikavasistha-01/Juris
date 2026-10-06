import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs';
import { canonicalizeText } from '../../packages/shared/src/text-normalization.js';

export interface ExtractedPage {
  pageNumber: number;
  rawText: string;
  lines: string[];
}

export interface SampledQuote {
  id: string;
  category: 'single-line' | 'multi-line' | 'hyphenated' | 'ligature' | 'numeric';
  pageNumber: number;
  quote: string;
  expectedNormalized: string;
}

/**
 * Extracts per-page text layers from a PDF file using pdfjs-dist.
 */
export async function extractPdfPages(
  pdfPath: string,
  maxPages: number = 20,
): Promise<ExtractedPage[]> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const pages: ExtractedPage[] = [];

  for (let p = 1; p <= pageCount; p++) {
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str: string; hasEOL?: boolean }>;

    const lines: string[] = [];
    let currentLine = '';

    for (const item of items) {
      if (item.str) {
        currentLine += (currentLine.length > 0 && !currentLine.endsWith(' ') ? ' ' : '') + item.str;
      }
      if (item.hasEOL) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = '';
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    const rawText = lines.join('\n');
    pages.push({
      pageNumber: p,
      rawText,
      lines,
    });
  }

  return pages;
}

/**
 * Programmatically samples quotes across the 5 categories defined in the spike specification.
 */
export function sampleQuotesFromPages(pages: ExtractedPage[]): SampledQuote[] {
  const sampled: SampledQuote[] = [];
  let idCounter = 1;

  for (const page of pages) {
    const { pageNumber, lines } = page;

    // 1. Single-line quotes
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length >= 25 && line.length <= 80 && !line.includes('---')) {
        sampled.push({
          id: `Q-${idCounter++}`,
          category: 'single-line',
          pageNumber,
          quote: line,
          expectedNormalized: canonicalizeText(line),
        });
        break; // 1 per page to keep diverse
      }
    }

    // 2. Multi-line quotes (2-3 consecutive lines)
    for (let i = 0; i < lines.length - 1; i++) {
      const l1 = lines[i];
      const l2 = lines[i + 1];
      if (l1.length >= 20 && l2.length >= 20 && !l1.endsWith('.') && !l1.includes(':')) {
        const combined = `${l1} ${l2}`;
        sampled.push({
          id: `Q-${idCounter++}`,
          category: 'multi-line',
          pageNumber,
          quote: combined,
          expectedNormalized: canonicalizeText(combined),
        });
        break;
      }
    }

    // 3. Hyphenated quotes
    for (const line of lines) {
      if (line.includes('-') || line.includes('‐') || line.includes('–')) {
        const words = line.split(' ');
        const hyphenWordIdx = words.findIndex(
          (w) => w.includes('-') || w.includes('‐') || w.includes('–'),
        );
        if (hyphenWordIdx !== -1) {
          const start = Math.max(0, hyphenWordIdx - 2);
          const end = Math.min(words.length, hyphenWordIdx + 3);
          const snippet = words.slice(start, end).join(' ');
          if (snippet.length >= 15) {
            sampled.push({
              id: `Q-${idCounter++}`,
              category: 'hyphenated',
              pageNumber,
              quote: snippet,
              expectedNormalized: canonicalizeText(snippet),
            });
            break;
          }
        }
      }
    }

    // 4. Numeric / financial quotes
    for (const line of lines) {
      if (
        /\d+([.,]\d+)?\s*(crore|lakh|percent|%|₹|Rs\.|INR|billion|million)/i.test(line) ||
        /\b\d{1,3}(,\d{2,3})+\b/.test(line)
      ) {
        const match = line.match(
          /([^\n.]{0,30}\b\d+([.,]\d+)?\s*(crore|lakh|%|₹|Rs\.|INR)?[^\n.]{0,30})/i,
        );
        if (match && match[0].trim().length >= 15) {
          sampled.push({
            id: `Q-${idCounter++}`,
            category: 'numeric',
            pageNumber,
            quote: match[0].trim(),
            expectedNormalized: canonicalizeText(match[0].trim()),
          });
          break;
        }
      }
    }

    // 5. Ligature / typographic quotes
    for (const line of lines) {
      if (/[“’”«»fi|fl|ff]/.test(line) || /['"]/.test(line)) {
        if (line.length >= 20 && line.length <= 100) {
          sampled.push({
            id: `Q-${idCounter++}`,
            category: 'ligature',
            pageNumber,
            quote: line,
            expectedNormalized: canonicalizeText(line),
          });
          break;
        }
      }
    }
  }

  return sampled;
}
