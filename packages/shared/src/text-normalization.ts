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
