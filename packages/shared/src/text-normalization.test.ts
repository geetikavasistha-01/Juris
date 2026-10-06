import { describe, expect, it } from 'vitest';
import {
  canonicalizeText,
  collapseWhitespace,
  findQuoteInPage,
  normalizeCharacters,
  normalizeLineBreaks,
} from './text-normalization.js';

describe('text-normalization', () => {
  describe('normalizeCharacters', () => {
    it('normalizes Unicode ligatures correctly', () => {
      expect(normalizeCharacters('financial ﬁgures & ﬂow')).toBe('financial figures & flow');
      expect(normalizeCharacters('eﬃcient oﬃce')).toBe('efficient office');
    });

    it('normalizes curved quotes and typographic apostrophes', () => {
      expect(normalizeCharacters('“Government’s revenue” and ‘capital’')).toBe(
        "\"Government's revenue\" and 'capital'",
      );
      expect(normalizeCharacters('«European Union»')).toBe('"European Union"');
    });

    it('normalizes en-dashes, em-dashes, and minus signs', () => {
      expect(normalizeCharacters('2025–2026 budget—revised −10%')).toBe(
        '2025-2026 budget-revised -10%',
      );
    });

    it('strips zero-width characters and soft hyphens', () => {
      const input = 'zero\u200Bwidth\uFEFFspace\u00ADsoft';
      expect(normalizeCharacters(input)).toBe('zerowidthspacesoft');
    });
  });

  describe('normalizeLineBreaks', () => {
    it('joins hyphenated words across line wraps', () => {
      const input = 'The infra-\nstructure capital expendi-\r\nture target';
      expect(normalizeLineBreaks(input)).toBe('The infrastructure capital expenditure target');
    });

    it('replaces remaining newlines with spaces', () => {
      const input = 'Line one.\nLine two.\r\nLine three.';
      expect(normalizeLineBreaks(input)).toBe('Line one. Line two. Line three.');
    });
  });

  describe('collapseWhitespace', () => {
    it('collapses multiple spaces, tabs, and trims ends', () => {
      expect(collapseWhitespace('   Total   Amount:   1,234   ')).toBe('Total Amount: 1,234');
    });
  });

  describe('canonicalizeText', () => {
    it('executes full pipeline deterministically', () => {
      const input = '  “The   infra-\nstructure   allocaﬁon   is   ₹10,000   crore”  ';
      expect(canonicalizeText(input)).toBe('"The infrastructure allocafion is ₹10,000 crore"');
    });
  });

  describe('findQuoteInPage', () => {
    const rawPage = `The Ministry of Finance announces the Revised Estimates for 2025–2026.
Total expendi-
ture is estimated at ₹48,20,512 crore, of which capital expendi-
ture is ₹11,11,111 crore (an increase of 16.9%).
Special focus is on infra-
structure development and health‐care.`;

    it('finds exact raw substrings', () => {
      const result = findQuoteInPage(rawPage, 'Revised Estimates');
      expect(result.matched).toBe(true);
      expect(result.exactMatch).toBe(true);
      expect(result.startIndex).toBeGreaterThan(-1);
    });

    it('finds quotes broken across lines and hyphens', () => {
      const quote = 'Total expenditure is estimated at ₹48,20,512 crore';
      const result = findQuoteInPage(rawPage, quote);
      expect(result.matched).toBe(true);
      expect(result.exactMatch).toBe(false);
      expect(result.startIndex).toBeGreaterThan(-1);
    });

    it('finds quotes with different quotation marks and dashes', () => {
      const result = findQuoteInPage(rawPage, 'Revised Estimates for 2025-2026');
      expect(result.matched).toBe(true);
    });

    it('returns matched=false deterministically when quote is missing (no false positives)', () => {
      const quote = 'Total revenue is estimated at $99,000 billion';
      const result = findQuoteInPage(rawPage, quote);
      expect(result.matched).toBe(false);
      expect(result.startIndex).toBe(-1);
    });
  });
});
