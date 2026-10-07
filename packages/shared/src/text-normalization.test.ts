import { describe, expect, it } from 'vitest';
import {
  canonicalizeText,
  collapseWhitespace,
  findQuoteInPage,
  normalizeCharacters,
  normalizeLineBreaks,
  verifyFactQuoteAndValue,
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

  describe('verifyFactQuoteAndValue & Negative Controls', () => {
    const pageText = `Budget Speech 2026-27: The BE 2026-27 for the revenue receipts are Rs.5,211.92 Crore against Rs.4,964.73 Crore provided in RE 2025-26. Total capital allocation is Rs.741.15 Crore.`;

    it('successfully verifies a fact with matching quote and numeric value', () => {
      const result = verifyFactQuoteAndValue(pageText, {
        page: 33,
        quote: 'The BE 2026-27 for the revenue receipts are Rs.5,211.92 Crore',
        value: 5211.92,
      });
      expect(result.verified).toBe(true);
      expect(result.quoteMatched).toBe(true);
      expect(result.valueMatched).toBe(true);
      expect(result.failReason).toBeUndefined();
    });

    it('NEGATIVE CONTROL 1: rejects a quote altered by one character', () => {
      const result = verifyFactQuoteAndValue(pageText, {
        page: 33,
        quote: 'The BE 2026-27 for the revenue receipts are Rs.5,211.92 CroresX',
        value: 5211.92,
      });
      expect(result.verified).toBe(false);
      expect(result.quoteMatched).toBe(false);
      expect(result.failReason).toContain('Quote');
    });

    it('NEGATIVE CONTROL 2: rejects when the numeric value does not match quote content', () => {
      const result = verifyFactQuoteAndValue(pageText, {
        page: 33,
        quote: 'The BE 2026-27 for the revenue receipts are Rs.5,211.92 Crore',
        value: 9999.99, // Wrong value!
      });
      expect(result.verified).toBe(false);
      expect(result.quoteMatched).toBe(true);
      expect(result.valueMatched).toBe(false);
      expect(result.failReason).toContain('Numeric value 9999.99 does not appear in quote');
    });

    it('NEGATIVE CONTROL 3: rejects when checked against a wrong/different page', () => {
      const wrongPageText = `This is Page 12 discussing horticulture and tree planting in municipal parks.`;
      const result = verifyFactQuoteAndValue(wrongPageText, {
        page: 12,
        quote: 'The BE 2026-27 for the revenue receipts are Rs.5,211.92 Crore',
        value: 5211.92,
      });
      expect(result.verified).toBe(false);
      expect(result.quoteMatched).toBe(false);
      expect(result.failReason).toContain('not found on page 12');
    });

    it('successfully verifies a fact with matching period token in quote or context', () => {
      const result = verifyFactQuoteAndValue(pageText, {
        page: 33,
        quote: 'The BE 2026-27 for the revenue receipts are Rs.5,211.92 Crore',
        value: 5211.92,
        period: '2026-27',
      });
      expect(result.verified).toBe(true);
      expect(result.periodMatched).toBe(true);
    });

    it('NEGATIVE CONTROL 4: rejects when cited period does not appear in quote or surrounding context', () => {
      const result = verifyFactQuoteAndValue(pageText, {
        page: 33,
        quote: 'The BE 2026-27 for the revenue receipts are Rs.5,211.92 Crore',
        value: 5211.92,
        period: '2029-30', // Not in quote or context!
      });
      expect(result.verified).toBe(false);
      expect(result.periodMatched).toBe(false);
      expect(result.failReason).toContain('Period "2029-30" not found');
    });

    it('NEGATIVE CONTROL 5: rejects a 2024-25 fact carrying an invalid 2026-27 period tag', () => {
      const text2024 =
        'Outstanding CBSE Board Result achieved in FY 2024-25 with highest pass percentage.';
      const result = verifyFactQuoteAndValue(text2024, {
        page: 24,
        quote: 'Outstanding CBSE Board Result achieved in FY 2024-25',
        period: '2026-27', // Mismatched period!
      });
      expect(result.verified).toBe(false);
      expect(result.periodMatched).toBe(false);
      expect(result.failReason).toContain('Period "2026-27" not found');
    });
  });
});
