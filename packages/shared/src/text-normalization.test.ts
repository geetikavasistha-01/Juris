import { describe, expect, it } from 'vitest';
import {
  normalizeCanonical,
  normalizeWhitespace,
  normalizePunctuation,
  normalizeHyphenation,
  findQuoteInPage,
  verifyFactQuoteAndValue,
} from './text-normalization.js';

describe('text-normalization & Fact Verifier Suite', () => {
  describe('deterministic normalization functions', () => {
    it('normalizes Unicode ligatures correctly', () => {
      expect(normalizePunctuation('financial ﬁgures & ﬂow')).toBe('financial figures & flow');
      expect(normalizePunctuation('eﬃcient oﬃce')).toBe('efficient office');
    });

    it('normalizes curved quotes and typographic apostrophes', () => {
      expect(normalizePunctuation('“Government’s revenue” and ‘capital’')).toBe(
        "\"Government's revenue\" and 'capital'",
      );
      expect(normalizePunctuation('«European Union»')).toBe('"European Union"');
    });

    it('normalizes en-dashes, em-dashes, and minus signs', () => {
      expect(normalizePunctuation('2025–2026 budget—revised −10%')).toBe(
        '2025-2026 budget-revised -10%',
      );
    });

    it('strips zero-width characters and soft hyphens', () => {
      const input = 'zero\u200Bwidth\uFEFFspace\u00ADsoft';
      expect(normalizeHyphenation(input)).toBe('zerowidth\uFEFFspacesoft');
    });

    it('joins hyphenated words across line wraps', () => {
      const input = 'The infra-\nstructure capital expendi-\r\nture target';
      expect(normalizeCanonical(input)).toBe('The infrastructure capital expenditure target');
    });

    it('collapses multiple spaces, tabs, and trims ends', () => {
      expect(normalizeWhitespace('   Total   Amount:   1,234   ')).toBe('Total Amount: 1,234');
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

  describe('Positive Fixtures (Real Budget Speech Ground Truth)', () => {
    const page33Text = `iv. The total expenditure for BE 2026-27 are Rs.5810.02 Crore against Rs.5484.15 Crore provided in RE 2025-26 and actual of Rs.4678.45 Crore in 2024-25.
ii. The BE 2026-27 for the revenue receipts are Rs.5211.92 Crore against Rs.4964.73 Crore provided in RE 2025-26 and actual of Rs.4606.56 Crore in 2024-25.`;

    const page87Text = `In the year 2026-27, I propose to allocate Rs.118.33`;
    const page88Text = `crore towards improvement of Medical Services Department out of which Rs.12.71 crore towards Capital Expenditure and Rs.105.62 crore towards Revenue Expenditure.`;

    it('verifies Revenue Receipts 5211.92 crore BE 2026-27 on page 33', () => {
      const result = verifyFactQuoteAndValue(page33Text, {
        page: 33,
        label: 'Revenue Receipts BE 2026-27',
        type: 'receipt',
        value: 5211.92,
        unit: 'crore',
        period: { basis: 'BE', fiscalYear: '2026-27' },
        quote: 'The BE 2026-27 for the revenue receipts are Rs.5211.92 Crore',
      });
      expect(result.verified).toBe(true);
      expect(result.failReason).toBeNull();
    });

    it('verifies Revenue Receipts 4964.73 crore RE 2025-26 on page 33', () => {
      const result = verifyFactQuoteAndValue(page33Text, {
        page: 33,
        label: 'Revenue Receipts RE 2025-26',
        type: 'receipt',
        value: 4964.73,
        unit: 'crore',
        period: { basis: 'RE', fiscalYear: '2025-26' },
        quote: 'against Rs.4964.73 Crore provided in RE 2025-26',
      });
      expect(result.verified).toBe(true);
      expect(result.failReason).toBeNull();
    });

    it('verifies Total Expenditure 5810.02 crore BE 2026-27 on page 33', () => {
      const result = verifyFactQuoteAndValue(page33Text, {
        page: 33,
        label: 'Total Expenditure BE 2026-27',
        type: 'financial_total',
        value: 5810.02,
        unit: 'crore',
        period: { basis: 'BE', fiscalYear: '2026-27' },
        quote: 'The total expenditure for BE 2026-27 are Rs.5810.02 Crore',
      });
      expect(result.verified).toBe(true);
      expect(result.failReason).toBeNull();
    });

    it('verifies Total Expenditure 5484.15 crore RE 2025-26 on page 33', () => {
      const result = verifyFactQuoteAndValue(page33Text, {
        page: 33,
        label: 'Total Expenditure RE 2025-26',
        type: 'financial_total',
        value: 5484.15,
        unit: 'crore',
        period: { basis: 'RE', fiscalYear: '2025-26' },
        quote: 'against Rs.5484.15 Crore provided in RE 2025-26',
      });
      expect(result.verified).toBe(true);
      expect(result.failReason).toBeNull();
    });

    it('verifies Capital Expenditure 12.71 crore on page 88', () => {
      const result = verifyFactQuoteAndValue(page88Text, {
        page: 88,
        label: 'Medical Services Capital Expenditure',
        type: 'expenditure',
        value: 12.71,
        unit: 'crore',
        quote: 'Rs.12.71 crore towards Capital Expenditure',
      });
      expect(result.verified).toBe(true);
      expect(result.failReason).toBeNull();
    });

    it('verifies Revenue Expenditure 105.62 crore on page 88', () => {
      const result = verifyFactQuoteAndValue(page88Text, {
        page: 88,
        label: 'Medical Services Revenue Expenditure',
        type: 'expenditure',
        value: 105.62,
        unit: 'crore',
        quote: 'Rs.105.62 crore towards Revenue Expenditure',
      });
      expect(result.verified).toBe(true);
      expect(result.failReason).toBeNull();
    });

    it('verifies Medical Services allocation 118.33 crore stored on page 87 where number appears', () => {
      const result = verifyFactQuoteAndValue(page87Text, {
        page: 87,
        label: 'Medical Services Department Allocation',
        type: 'allocation',
        value: 118.33,
        unit: 'crore',
        period: { basis: 'none', fiscalYear: '2026-27' },
        quote: 'In the year 2026-27, I propose to allocate Rs.118.33',
      });
      expect(result.verified).toBe(true);
      expect(result.failReason).toBeNull();
    });
  });

  describe('Negative Controls (Anti-Hallucination & Rejection Rules)', () => {
    const speechSnippet = `9. Technology Maximum: Information Technology Governance
12. Swachh NDMC: Public Health
14. Prudent NDMC: Financial Stability
15. Caring NDMC: Employee and Citizen Welfare
10. Swasth NDMC: Medical Services
urban infrastructure aligning with “ Vision @ 2047” to
by March, 2026 after completion of other
Chief Minister on 4th September, 2025. 240 NDMC
2020. One of the most prominent initiative is design of
Result achieved in FY 2024 - 25 with highest pass
will be finalized in the current FY 2025-26.
Minister on 2nd Oct., 2024 on the birth
is likely to be started in next FY 2026-27.`;

    it('rejects heading numbers stored as values: 9. Technology Maximum', () => {
      const res = verifyFactQuoteAndValue(speechSnippet, {
        page: 2,
        value: 9,
        type: 'count',
        quote: '9. Technology Maximum: Information Technology Governance',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('HEADING_NUMBER');
    });

    it('rejects heading numbers stored as values: 12. Swachh NDMC', () => {
      const res = verifyFactQuoteAndValue(speechSnippet, {
        page: 2,
        value: 12,
        type: 'count',
        quote: '12. Swachh NDMC: Public Health',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('HEADING_NUMBER');
    });

    it('rejects heading numbers stored as values: 14. Prudent NDMC', () => {
      const res = verifyFactQuoteAndValue(speechSnippet, {
        page: 2,
        value: 14,
        type: 'count',
        quote: '14. Prudent NDMC: Financial Stability',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('HEADING_NUMBER');
    });

    it('rejects heading numbers stored as values: 10. Swasth NDMC', () => {
      const res = verifyFactQuoteAndValue(speechSnippet, {
        page: 2,
        value: 10,
        type: 'count',
        quote: '10. Swasth NDMC: Medical Services',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('HEADING_NUMBER');
    });

    it('rejects heading numbers stored as values: 15. Caring NDMC', () => {
      const res = verifyFactQuoteAndValue(speechSnippet, {
        page: 2,
        value: 15,
        type: 'count',
        quote: '15. Caring NDMC: Employee and Citizen Welfare',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('HEADING_NUMBER');
    });

    it('rejects calendar years stored as measured values: 2047 in Vision @ 2047', () => {
      const res = verifyFactQuoteAndValue(speechSnippet, {
        page: 3,
        value: 2047,
        type: 'count',
        quote: 'urban infrastructure aligning with “ Vision @ 2047” to',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('YEAR_OR_DATE_AS_VALUE');
    });

    it('rejects calendar years stored as measured values: March, 2026', () => {
      const res = verifyFactQuoteAndValue(speechSnippet, {
        page: 5,
        value: 2026,
        type: 'count',
        quote: 'by March, 2026 after completion of other',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('YEAR_OR_DATE_AS_VALUE');
    });

    it('rejects calendar years stored as measured values: September, 2025', () => {
      const res = verifyFactQuoteAndValue(speechSnippet, {
        page: 6,
        value: 2025,
        type: 'count',
        quote: 'Chief Minister on 4th September, 2025.',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('YEAR_OR_DATE_AS_VALUE');
    });

    it('rejects calendar years stored as measured values: 2020.', () => {
      const res = verifyFactQuoteAndValue(speechSnippet, {
        page: 6,
        value: 2020,
        type: 'count',
        quote: '2020. One of the most prominent initiative is design of',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('YEAR_OR_DATE_AS_VALUE');
    });

    it('rejects calendar years stored as measured values: FY 2024 - 25', () => {
      const res = verifyFactQuoteAndValue(speechSnippet, {
        page: 6,
        value: 2024,
        type: 'count',
        quote: 'Result achieved in FY 2024 - 25 with highest pass',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('YEAR_OR_DATE_AS_VALUE');
    });

    it('rejects calendar years stored as measured values: FY 2025-26', () => {
      const res = verifyFactQuoteAndValue(speechSnippet, {
        page: 7,
        value: 2025,
        type: 'count',
        quote: 'will be finalized in the current FY 2025-26.',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('YEAR_OR_DATE_AS_VALUE');
    });

    it('rejects calendar years stored as measured values: next FY 2026-27', () => {
      const res = verifyFactQuoteAndValue(speechSnippet, {
        page: 9,
        value: 2026,
        type: 'count',
        quote: 'is likely to be started in next FY 2026-27.',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('YEAR_OR_DATE_AS_VALUE');
    });

    it('rejects hallucinated values: VALUE_NOT_IN_QUOTE', () => {
      const res = verifyFactQuoteAndValue('The capital allocation is Rs.741.15 Crore.', {
        page: 1,
        value: 9999.99,
        type: 'allocation',
        unit: 'crore',
        quote: 'The capital allocation is Rs.741.15 Crore.',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('VALUE_NOT_IN_QUOTE');
    });

    it('rejects missing units on financial facts: MISSING_REQUIRED_UNIT', () => {
      const res = verifyFactQuoteAndValue('The total expenditure is Rs.5810.02 Crore.', {
        page: 1,
        value: 5810.02,
        type: 'expenditure',
        unit: null,
        quote: 'The total expenditure is Rs.5810.02 Crore.',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('MISSING_REQUIRED_UNIT');
    });

    it('rejects unit mismatch: UNIT_NOT_IN_QUOTE', () => {
      const res = verifyFactQuoteAndValue('The road resurfacing covers 450 meters.', {
        page: 1,
        value: 450,
        type: 'physical_quantity',
        unit: 'crore',
        quote: 'The road resurfacing covers 450 meters.',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('UNIT_NOT_IN_QUOTE');
    });

    it('rejects mismatched period citation: PERIOD_NOT_IN_QUOTE', () => {
      const res = verifyFactQuoteAndValue('The revenue receipts are Rs.5211.92 Crore in 2024-25.', {
        page: 1,
        value: 5211.92,
        type: 'receipt',
        unit: 'crore',
        period: { basis: 'BE', fiscalYear: '2026-27' },
        quote: 'The revenue receipts are Rs.5211.92 Crore in 2024-25.',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('PERIOD_NOT_IN_QUOTE');
    });

    it('rejects quote not found on page: QUOTE_NOT_ON_SINGLE_PAGE', () => {
      const res = verifyFactQuoteAndValue('Page text without the quote.', {
        page: 1,
        value: 100,
        type: 'count',
        quote: 'Unrelated missing text string',
      });
      expect(res.verified).toBe(false);
      expect(res.failReason).toBe('QUOTE_NOT_ON_SINGLE_PAGE');
    });
  });
});
