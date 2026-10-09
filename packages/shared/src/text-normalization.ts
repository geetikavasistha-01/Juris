/**
 * Deterministic text normalization and verbatim quote verification for Juris.
 * Follows PRD Section 5.1 and ADR-004.
 */

import type { FactFailReason, FactPeriod, FactType } from './documents.js';

export interface QuoteMatchResult {
  matched: boolean;
  exactMatch: boolean;
  startIndex: number;
  endIndex: number;
  normalizedPageText: string;
  normalizedQuote: string;
}

/**
 * Normalizes text for comparison by collapsing all whitespace sequences
 * (spaces, tabs, newlines, non-breaking spaces) to a single ASCII space
 * and trimming leading/trailing whitespace.
 */
export function normalizeWhitespace(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\r\n\t\f\v\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g, ' ')
    .replace(/[ ]+/g, ' ')
    .trim();
}

/**
 * Normalizes unicode punctuation variants (smart quotes, dashes, ligatures)
 * to their ASCII equivalents.
 */
export function normalizePunctuation(text: string): string {
  if (!text) return '';
  return (
    text
      // Smart double quotes -> standard double quote
      .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB\u2033\u2036]/g, '"')
      // Smart single quotes / apostrophes -> standard single quote
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u0060\u00B4]/g, "'")
      // Hyphens, en-dashes, em-dashes, minus signs -> standard hyphen
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
      // Ligatures
      .replace(/\uFB00/g, 'ff')
      .replace(/\uFB01/g, 'fi')
      .replace(/\uFB02/g, 'fl')
      .replace(/\uFB03/g, 'ffi')
      .replace(/\uFB04/g, 'ffl')
      .replace(/\uFB05/g, 'st')
      .replace(/\uFB06/g, 'st')
  );
}

/**
 * Strips discretionary / soft hyphens and de-hyphenates words broken across lines.
 */
export function normalizeHyphenation(text: string): string {
  if (!text) return '';
  return (
    text
      // Remove soft hyphen (\u00AD) and zero-width spaces (\u200B)
      .replace(/[\u00AD\u200B]/g, '')
      // Join hyphenated words broken across whitespace: e.g. "com- prehensive" -> "comprehensive"
      .replace(/([a-zA-Z]{2,})-\s+([a-zA-Z]{2,})/g, '$1$2')
  );
}

/**
 * Applies full deterministic normalization pipeline to a string.
 */
export function normalizeCanonical(text: string): string {
  if (!text) return '';
  return normalizeWhitespace(normalizePunctuation(normalizeHyphenation(text)));
}

export const canonicalizeText = normalizeCanonical;

/**
 * Normalizes text specifically for quote verification by lowercasing,
 * stripping punctuation, and standardizing number formatting.
 */
export function normalizeForVerification(text: string): string {
  if (!text) return '';
  return (
    normalizeCanonical(text)
      .toLowerCase()
      // Standardize currency symbols and abbreviations
      .replace(/₹|rs\.?|inr/gi, 'rs')
      // Standardize unit abbreviations
      .replace(/\bcrores?\b|\bcr\b/gi, 'crore')
      .replace(/\blakhs?\b|\bl\b/gi, 'lakh')
  );
}

/**
 * Attempts to locate a verbatim quote within extracted page text.
 */
export function findQuoteInPage(pageText: string, quote: string): QuoteMatchResult {
  const notFound: QuoteMatchResult = {
    matched: false,
    exactMatch: false,
    startIndex: -1,
    endIndex: -1,
    normalizedPageText: '',
    normalizedQuote: '',
  };

  if (!pageText || !quote) return notFound;

  // 1. Direct exact substring match
  const exactIndex = pageText.indexOf(quote);
  if (exactIndex !== -1) {
    return {
      matched: true,
      exactMatch: true,
      startIndex: exactIndex,
      endIndex: exactIndex + quote.length,
      normalizedPageText: pageText,
      normalizedQuote: quote,
    };
  }

  // 2. Canonical normalization match (whitespace + unicode punctuation)
  const canonPage = normalizeCanonical(pageText);
  const canonQuote = normalizeCanonical(quote);
  const canonIndex = canonPage.indexOf(canonQuote);
  if (canonIndex !== -1) {
    return {
      matched: true,
      exactMatch: false,
      startIndex: canonIndex,
      endIndex: canonIndex + canonQuote.length,
      normalizedPageText: canonPage,
      normalizedQuote: canonQuote,
    };
  }

  // 3. Normalized verification match (case-insensitive + punctuation stripped)
  const normPage = normalizeForVerification(pageText);
  const normQuote = normalizeForVerification(quote);
  const normIdx = normPage.indexOf(normQuote);
  if (normIdx !== -1) {
    return {
      matched: true,
      exactMatch: false,
      startIndex: normIdx,
      endIndex: normIdx + normQuote.length,
      normalizedPageText: normPage,
      normalizedQuote: normQuote,
    };
  }

  return {
    ...notFound,
    normalizedPageText: normPage,
    normalizedQuote: normQuote,
  };
}

export interface FactVerificationInput {
  quote: string;
  label?: string;
  type?: FactType | string;
  value?: number | null;
  unit?: string | null;
  period?: FactPeriod | string | null;
  page: number;
}

export interface FactVerificationResult {
  verified: boolean;
  failReason: FactFailReason | null;
  quoteMatched: boolean;
  valueMatched: boolean;
  periodMatched: boolean;
  exactMatch: boolean;
}

/**
 * Detects if a numeric value is a leading heading, section, or list index number.
 */
export function isHeadingOrListNumber(val: number, quote: string): boolean {
  const q = quote.trim();
  const valStr = String(val);

  // e.g. "9. Technology Maximum", "14. Prudent NDMC", "10. Swasth NDMC"
  const leadingPattern = new RegExp(`^${valStr}\\s*[.)-]`, 'i');
  if (leadingPattern.test(q)) return true;

  const embeddedHeading = new RegExp(`(?:^|[\\n\\r])\\s*${valStr}\\.\\s+[A-Z]`);
  if (embeddedHeading.test(q)) return true;

  // e.g. "Point 9", "Section 14", "Item 10"
  const sectionPattern = new RegExp(
    `\\b(?:section|item|point|clause|heading)\\s+${valStr}\\b`,
    'i',
  );
  if (sectionPattern.test(q)) return true;

  return false;
}

/**
 * Detects if a numeric value is a calendar year or date element rather than a measured quantity.
 */
export function isYearOrDateValue(val: number, quote: string): boolean {
  if (!Number.isInteger(val)) return false;

  // 4-digit years between 1900 and 2100
  if (val >= 1900 && val <= 2100) {
    const valStr = String(val);
    const yearContextPatterns = [
      new RegExp(
        `(?:vision\\s*@|year|march|september|october|november|december|january|february|in|by|fy|be|re)\\s*,?\\s*${valStr}`,
        'i',
      ),
      new RegExp(`${valStr}\\s*[-–]\\s*\\d{2,4}`, 'i'), // e.g. 2024-25, 2026-27
      new RegExp(`\\b(?:19|20)\\d{2}\\b`),
      new RegExp(
        `\\d+(?:st|nd|rd|th)?\\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[,\\s]+${valStr}`,
        'i',
      ),
      new RegExp(`${valStr}\\.`, 'i'),
    ];

    return yearContextPatterns.some((p) => p.test(quote));
  }

  // Ordinal day dates stored as values (e.g. 2nd, 4th, 15th)
  if (val >= 1 && val <= 31) {
    const valStr = String(val);
    const dateOrdinal = new RegExp(
      `\\b${valStr}(?:st|nd|rd|th)\\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)`,
      'i',
    );
    if (dateOrdinal.test(quote)) return true;
  }

  return false;
}

/**
 * Detects if a numeric value is simply a page number or serial document ID.
 */
export function isPageOrIdNumber(val: number, quote: string, page: number): boolean {
  if (val === page) {
    const pagePattern = new RegExp(`\\b(?:page|p\\.|pg\\.)\\s*${val}\\b`, 'i');
    if (pagePattern.test(quote)) return true;
  }
  return false;
}

/**
 * Verifies that a fact's verbatim quote appears on the specified page AND
 * that the fact's numeric value (if provided) appears inside the quote AND
 * that the fact's cited fiscal period (if provided) appears in the quote or surrounding sentence context AND
 * that the fact is not a heading, year, page number, or missing required unit.
 */
export function verifyFactQuoteAndValue(
  pageText: string,
  fact: FactVerificationInput,
): FactVerificationResult {
  if (!pageText) {
    return {
      verified: false,
      failReason: 'PAGE_TEXT_MISSING',
      quoteMatched: false,
      valueMatched: false,
      periodMatched: false,
      exactMatch: false,
    };
  }

  // 1. Verify quote exists on single page
  const quoteResult = findQuoteInPage(pageText, fact.quote);
  if (!quoteResult.matched) {
    return {
      verified: false,
      failReason: 'QUOTE_NOT_ON_SINGLE_PAGE',
      quoteMatched: false,
      valueMatched: false,
      periodMatched: false,
      exactMatch: false,
    };
  }

  // 2. If numeric value is present, run strict anti-hallucination checks
  if (fact.value !== undefined && fact.value !== null && Number.isFinite(fact.value)) {
    const val = fact.value;

    // Reject Year / Date numbers stored as measured values (check before heading)
    if (isYearOrDateValue(val, fact.quote)) {
      return {
        verified: false,
        failReason: 'YEAR_OR_DATE_AS_VALUE',
        quoteMatched: true,
        valueMatched: true,
        periodMatched: false,
        exactMatch: quoteResult.exactMatch,
      };
    }

    // Reject Heading Numbers
    if (isHeadingOrListNumber(val, fact.quote)) {
      return {
        verified: false,
        failReason: 'HEADING_NUMBER',
        quoteMatched: true,
        valueMatched: true,
        periodMatched: false,
        exactMatch: quoteResult.exactMatch,
      };
    }

    // Reject Page numbers
    if (isPageOrIdNumber(val, fact.quote, fact.page)) {
      return {
        verified: false,
        failReason: 'PAGE_OR_ID_NUMBER',
        quoteMatched: true,
        valueMatched: true,
        periodMatched: false,
        exactMatch: quoteResult.exactMatch,
      };
    }

    // Verify value appears inside quote
    const normQuote = quoteResult.normalizedQuote;
    const quoteWithoutNumberCommas = normQuote.replace(/(\d),(\d)/g, '$1$2');

    const valStr = String(val);
    const valWithCommas = val.toLocaleString('en-US');
    const valWithIndianCommas = val.toLocaleString('en-IN');

    const valueFound =
      quoteWithoutNumberCommas.includes(valStr) ||
      normQuote.includes(valWithCommas) ||
      normQuote.includes(valWithIndianCommas) ||
      normQuote.includes(valStr) ||
      fact.quote.includes(valStr);

    if (!valueFound) {
      return {
        verified: false,
        failReason: 'VALUE_NOT_IN_QUOTE',
        quoteMatched: true,
        valueMatched: false,
        periodMatched: false,
        exactMatch: quoteResult.exactMatch,
      };
    }
  }

  // 3. Unit validation for quantitative types
  const financialTypes: (FactType | string)[] = [
    'financial_total',
    'receipt',
    'expenditure',
    'allocation',
    'tax_collection',
  ];
  const requiresUnitTypes: (FactType | string)[] = [...financialTypes, 'physical_quantity'];

  if (fact.type && requiresUnitTypes.includes(fact.type)) {
    if (!fact.unit || fact.unit.trim().length === 0) {
      return {
        verified: false,
        failReason: 'MISSING_REQUIRED_UNIT',
        quoteMatched: true,
        valueMatched: true,
        periodMatched: false,
        exactMatch: quoteResult.exactMatch,
      };
    }

    const rawQuoteLower = fact.quote.toLowerCase();
    const normUnit = fact.unit.toLowerCase().trim();
    const unitTokens = [normUnit];
    if (normUnit === 'crore' || normUnit === 'crores') unitTokens.push('cr', 'crore');
    if (normUnit === 'lakh' || normUnit === 'lakhs') unitTokens.push('lakh', 'l');
    if (normUnit === 'percent' || normUnit === 'percentage') unitTokens.push('%', 'percent');
    if (normUnit === 'km' || normUnit === 'kilometer') unitTokens.push('km', 'kilometres');

    // For financial facts, presence of standard monetary indicators (Rs., ₹, INR) in quote satisfies unit marker
    if (financialTypes.includes(fact.type)) {
      unitTokens.push('rs', 'rs.', '₹', 'inr');
    }

    const unitInQuote = unitTokens.some(
      (t) => rawQuoteLower.includes(t) || quoteResult.normalizedQuote.toLowerCase().includes(t),
    );
    if (!unitInQuote) {
      return {
        verified: false,
        failReason: 'UNIT_NOT_IN_QUOTE',
        quoteMatched: true,
        valueMatched: true,
        periodMatched: false,
        exactMatch: quoteResult.exactMatch,
      };
    }
  }

  // 4. Period verification
  const periodFiscalYear =
    typeof fact.period === 'object' && fact.period !== null
      ? fact.period.fiscalYear
      : typeof fact.period === 'string'
        ? fact.period
        : null;

  if (periodFiscalYear && periodFiscalYear.trim().length > 0) {
    const rawPeriod = periodFiscalYear.trim();
    const periodTokens = [
      rawPeriod,
      rawPeriod.replace('-', '–'), // en-dash
      rawPeriod.replace('–', '-'), // hyphen
      rawPeriod.replace('/', '-'),
      rawPeriod.replace('/', '–'),
    ];

    const normQuote = quoteResult.normalizedQuote;
    const normPage = quoteResult.normalizedPageText;

    // Check if period token is directly in the quote
    const inQuote = periodTokens.some((t) => normQuote.includes(t.toLowerCase()));

    // Check surrounding sentence context
    let inSurroundingContext = false;
    if (!inQuote && quoteResult.startIndex >= 0) {
      const windowStart = Math.max(0, quoteResult.startIndex - 120);
      const windowEnd = Math.min(normPage.length, quoteResult.endIndex + 120);
      const surroundingSnippet = normPage.slice(windowStart, windowEnd);
      inSurroundingContext = periodTokens.some((t) => surroundingSnippet.includes(t.toLowerCase()));
    }

    if (!inQuote && !inSurroundingContext) {
      return {
        verified: false,
        failReason: 'PERIOD_NOT_IN_QUOTE',
        quoteMatched: true,
        valueMatched: true,
        periodMatched: false,
        exactMatch: quoteResult.exactMatch,
      };
    }
  }

  return {
    verified: true,
    failReason: null,
    quoteMatched: true,
    valueMatched: true,
    periodMatched: true,
    exactMatch: quoteResult.exactMatch,
  };
}
