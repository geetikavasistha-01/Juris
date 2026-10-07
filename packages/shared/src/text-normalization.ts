/**
 * Canonical text and quote normalization for PDF extraction and client-side viewer matching.
 * Shared across server verification (EVD-02) and frontend PDF.js quote highlighting (CHT-04).
 */

const LIGATURE_MAP: Record<string, string> = {
  '\uFB00': 'ff',
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
  '\uFB05': 'ft',
  '\uFB06': 'st',
  '\u00E6': 'ae',
  '\u00C6': 'AE',
  '\u0153': 'oe',
  '\u0152': 'OE',
};

const PUNCTUATION_MAP: Record<string, string> = {
  '\u2018': "'", // Left single quotation mark
  '\u2019': "'", // Right single quotation mark
  '\u201A': "'", // Single low-9 quotation mark
  '\u201B': "'", // Single high-reversed-9 quotation mark
  '\u201C': '"', // Left double quotation mark
  '\u201D': '"', // Right double quotation mark
  '\u201E': '"', // Double low-9 quotation mark
  '\u201F': '"', // Double high-reversed-9 quotation mark
  '\u00AB': '"', // Left-pointing double angle quotation mark
  '\u00BB': '"', // Right-pointing double angle quotation mark
  '\u2010': '-', // Hyphen
  '\u2011': '-', // Non-breaking hyphen
  '\u2012': '-', // Figure dash
  '\u2013': '-', // En dash
  '\u2014': '-', // Em dash
  '\u2015': '-', // Horizontal bar
  '\u2212': '-', // Minus sign
  '\u2026': '...', // Horizontal ellipsis
  '\u00A0': ' ', // Non-breaking space
  '\u2002': ' ', // En space
  '\u2003': ' ', // Em space
  '\u2004': ' ', // Three-per-em space
  '\u2005': ' ', // Four-per-em space
  '\u2006': ' ', // Six-per-em space
  '\u2007': ' ', // Figure space
  '\u2008': ' ', // Punctuation space
  '\u2009': ' ', // Thin space
  '\u200A': ' ', // Hair space
  '\u202F': ' ', // Narrow no-break space
  '\u205F': ' ', // Medium mathematical space
  '\u3000': ' ', // Ideographic space
  '\u00AD': '', // Soft hyphen (invisible)
  '\u200B': '', // Zero-width space
  '\u200C': '', // Zero-width non-joiner
  '\u200D': '', // Zero-width joiner
  '\uFEFF': '', // Byte order mark / zero-width no-break space
};

/**
 * Normalizes Unicode characters, ligatures, dashes, curved quotes, and zero-width spaces.
 */
export function normalizeCharacters(input: string): string {
  if (!input) return '';

  // 1. Unicode Compatibility Decomposition + Canonical Composition
  let text = input.normalize('NFKC');

  // 2. Replace known ligatures
  for (const [ligature, replacement] of Object.entries(LIGATURE_MAP)) {
    text = text.replaceAll(ligature, replacement);
  }

  // 3. Replace punctuation and spacing variants
  for (const [char, replacement] of Object.entries(PUNCTUATION_MAP)) {
    text = text.replaceAll(char, replacement);
  }

  return text;
}

/**
 * Normalizes line breaks and de-hyphenates words broken across line wraps.
 * Examples:
 *   "infra-\nstructure" -> "infrastructure"
 *   "well-\nknown" -> "well-known"
 */
export function normalizeLineBreaks(input: string): string {
  if (!input) return '';

  // Remove soft hyphens followed by whitespace or line break
  let text = input.replace(/\u00AD\s*/g, '');

  // Handle line-broken hyphenated words:
  // If the word part before and after hyphen are strictly letters, rejoin without hyphen or keep single space
  text = text.replace(/([A-Za-z])-[\r\n]+\s*([A-Za-z])/g, '$1$2');

  // Replace remaining newlines with spaces
  text = text.replace(/[\r\n]+/g, ' ');

  return text;
}

/**
 * Normalizes and collapses all whitespace sequences to a single space.
 */
export function collapseWhitespace(input: string): string {
  if (!input) return '';
  return input.replace(/\s+/g, ' ').trim();
}

/**
 * Full canonical normalization pipeline for quote extraction and verification.
 */
export function canonicalizeText(input: string): string {
  if (!input) return '';
  const chars = normalizeCharacters(input);
  const unhyphenated = normalizeLineBreaks(chars);
  return collapseWhitespace(unhyphenated);
}

export interface QuoteMatchResult {
  matched: boolean;
  exactMatch: boolean;
  startIndex: number;
  endIndex: number;
  normalizedPageText: string;
  normalizedQuote: string;
}

/**
 * Locates a verbatim quote in a page's extracted text layer.
 * Performs deterministic exact matching first, then canonicalized matching.
 * Does NOT perform fuzzy matching (all matches must be deterministic sub-string occurrences).
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

  if (!pageText || !quote) {
    return notFound;
  }

  // 1. Exact raw substring match
  const rawIdx = pageText.indexOf(quote);
  if (rawIdx !== -1) {
    return {
      matched: true,
      exactMatch: true,
      startIndex: rawIdx,
      endIndex: rawIdx + quote.length,
      normalizedPageText: pageText,
      normalizedQuote: quote,
    };
  }

  // 2. Canonicalized substring match (ligatures, hyphens, collapsed whitespace, uniform quotes)
  const normPage = canonicalizeText(pageText);
  const normQuote = canonicalizeText(quote);

  if (!normQuote) {
    return notFound;
  }

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
  value?: number | null;
  period?: string | null;
  page: number;
}

export interface FactVerificationResult {
  verified: boolean;
  failReason?: string;
  quoteMatched: boolean;
  valueMatched: boolean;
  periodMatched: boolean;
  exactMatch: boolean;
}

/**
 * Verifies that a fact's verbatim quote appears on the specified page AND
 * that the fact's numeric value (if provided) appears inside the quote AND
 * that the fact's cited fiscal period (if provided) appears in the quote or surrounding sentence context.
 */
export function verifyFactQuoteAndValue(
  pageText: string,
  fact: FactVerificationInput,
): FactVerificationResult {
  if (!pageText) {
    return {
      verified: false,
      failReason: `Page ${fact.page} text is empty or missing`,
      quoteMatched: false,
      valueMatched: false,
      periodMatched: false,
      exactMatch: false,
    };
  }

  // 1. Verify quote exists on page
  const quoteResult = findQuoteInPage(pageText, fact.quote);
  if (!quoteResult.matched) {
    return {
      verified: false,
      failReason: `Quote "${fact.quote}" not found on page ${fact.page}`,
      quoteMatched: false,
      valueMatched: false,
      periodMatched: false,
      exactMatch: false,
    };
  }

  // 2. If value is provided (numeric), verify that value appears in the quote
  if (fact.value !== undefined && fact.value !== null && Number.isFinite(fact.value)) {
    const val = fact.value;
    const normQuote = quoteResult.normalizedQuote;
    const quoteWithoutNumberCommas = normQuote.replace(/(\d),(\d)/g, '$1$2');

    const valStr = String(val);
    const valWithCommas = val.toLocaleString('en-US');
    const valWithIndianCommas = val.toLocaleString('en-IN');

    const valueFound =
      quoteWithoutNumberCommas.includes(valStr) ||
      normQuote.includes(valWithCommas) ||
      normQuote.includes(valWithIndianCommas) ||
      normQuote.includes(valStr);

    if (!valueFound) {
      return {
        verified: false,
        failReason: `Numeric value ${val} does not appear in quote "${fact.quote}"`,
        quoteMatched: true,
        valueMatched: false,
        periodMatched: false,
        exactMatch: quoteResult.exactMatch,
      };
    }
  }

  // 3. If period is provided, verify period token appears in the quote or surrounding sentence
  if (fact.period && fact.period.trim().length > 0) {
    const rawPeriod = fact.period.trim();
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

    // Check if period token appears in the surrounding sentence context around the quote match
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
        failReason: `Period "${rawPeriod}" not found in quote or surrounding sentence context on page ${fact.page}`,
        quoteMatched: true,
        valueMatched: true,
        periodMatched: false,
        exactMatch: quoteResult.exactMatch,
      };
    }
  }

  return {
    verified: true,
    quoteMatched: true,
    valueMatched: true,
    periodMatched: true,
    exactMatch: quoteResult.exactMatch,
  };
}
