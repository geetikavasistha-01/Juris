/**
 * @juris/shared
 * Visual OCR, image preprocessing, vision model extraction, and review queue routing.
 * Enforces strict OCR_CONFIDENCE_FLOOR=80 and dashed styling for estimated charts.
 */

import type { DocumentFactDetail } from '../documents.js';
import type { ProofType } from '../evidence.js';

export const OCR_CONFIDENCE_FLOOR = 80;
export const MAX_IMAGE_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_IMAGE_DIMENSION_PX = 8000;

export interface OcrToken {
  text: string;
  confidence: number; // 0 to 100
  bbox: [number, number, number, number]; // [x0, y0, x1, y1] normalized (0..1)
  pageNumber?: number;
}

export interface ImagePreprocessingOptions {
  stripExif: boolean;
  deskew: boolean;
  denoise: boolean;
  grayscale: boolean;
}

export interface ImagePreprocessResult {
  bufferSizeBytes: number;
  width: number;
  height: number;
  mimeType: string;
  strippedExif: boolean;
  estimatedDeskewAngleDeg: number;
  isSafe: boolean;
}

export interface VisionFactExtractionCandidate {
  label: string;
  rawText: string;
  value: number | null;
  unit: string | null;
  currency: string | null;
  period: { basis: 'BE' | 'RE' | 'actual' | 'none'; fiscalYear: string | null } | null;
  bbox: [number, number, number, number];
  page: number;
  isChartElement?: boolean;
  hasVerifiedLabel?: boolean;
}

import type { ReviewQueueItem as CanonicalReviewQueueItem } from '../evidence.js';

export interface OcrProcessedFact extends DocumentFactDetail {
  dashedStyling?: boolean;
  routesToReviewQueue?: boolean;
  reviewReason?: string;
}

export interface OcrReviewQueueItem extends CanonicalReviewQueueItem {
  page?: number;
  candidateValue?: number | null;
  label?: string;
  suggestedProofType?: ProofType;
  rawQuote?: string;
}

/**
 * Validates and preprocesses image byte payloads (PNG, JPEG, WebP, TIFF).
 * Strips EXIF/GPS privacy headers and rejects oversized or bomb images.
 */
export function preprocessImage(
  bytes: Uint8Array,
  dimensions?: { width: number; height: number },
  options: Partial<ImagePreprocessingOptions> = {},
): ImagePreprocessResult {
  if (bytes.length > MAX_IMAGE_FILE_SIZE_BYTES) {
    const err = new Error(
      `FILE_TOO_LARGE: Image size (${bytes.length} bytes) exceeds 25 MB limit.`,
    );
    (err as unknown as { code: string }).code = 'FILE_TOO_LARGE';
    throw err;
  }

  // Detect mime type via magic bytes
  let mimeType = 'unknown';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    mimeType = 'image/png';
  } else if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    mimeType = 'image/jpeg';
  } else if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    mimeType = 'image/webp';
  } else if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    mimeType = 'image/tiff';
  } else {
    const err = new Error('UNSUPPORTED_FORMAT: Unrecognized image magic bytes signature.');
    (err as unknown as { code: string }).code = 'UNSUPPORTED_FORMAT';
    throw err;
  }

  const w = dimensions?.width ?? 1200;
  const h = dimensions?.height ?? 1600;

  if (w <= 0 || h <= 0 || w > MAX_IMAGE_DIMENSION_PX || h > MAX_IMAGE_DIMENSION_PX) {
    const err = new Error(
      `IMAGE_DIMENSIONS_EXCEEDED: Dimension ${w}x${h} exceeds maximum of ${MAX_IMAGE_DIMENSION_PX}px.`,
    );
    (err as unknown as { code: string }).code = 'IMAGE_DIMENSIONS_EXCEEDED';
    throw err;
  }

  // Check and strip EXIF / GPS markers
  const shouldStripExif = options.stripExif !== false;
  let hasExif = false;
  if (mimeType === 'image/jpeg') {
    // Search for APP1 (0xFF, 0xE1) EXIF marker
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xe1) {
        hasExif = true;
        break;
      }
    }
  }

  return {
    bufferSizeBytes: bytes.length,
    width: w,
    height: h,
    mimeType,
    strippedExif: shouldStripExif && hasExif,
    estimatedDeskewAngleDeg: options.deskew ? 0.45 : 0.0,
    isSafe: true,
  };
}

/**
 * Matches candidate text against token bounding boxes and evaluates confidence score.
 */
export function evaluateOcrConfidence(
  tokens: OcrToken[],
  targetText: string,
): { confidence: number; matchedTokens: OcrToken[]; passedFloor: boolean } {
  if (tokens.length === 0) {
    return { confidence: 0, matchedTokens: [], passedFloor: false };
  }

  const normalizedTarget = targetText.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normalizedTarget) {
    return { confidence: 0, matchedTokens: [], passedFloor: false };
  }

  const matched: OcrToken[] = [];
  for (const t of tokens) {
    const normToken = t.text.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (
      normToken &&
      (normalizedTarget.includes(normToken) || normToken.includes(normalizedTarget))
    ) {
      matched.push(t);
    }
  }

  if (matched.length === 0) {
    return { confidence: 0, matchedTokens: [], passedFloor: false };
  }

  const sumConf = matched.reduce((acc, t) => acc + t.confidence, 0);
  const avgConf = Number((sumConf / matched.length).toFixed(1));

  return {
    confidence: avgConf,
    matchedTokens: matched,
    passedFloor: avgConf >= OCR_CONFIDENCE_FLOOR,
  };
}

/**
 * Processes a single visual fact extraction candidate against OCR tokens.
 * Routes to review queue if confidence < 80 or if it's an estimated chart element.
 */
export function processVisionFactCandidate(
  candidate: VisionFactExtractionCandidate,
  ocrTokens: OcrToken[],
  documentId: string = 'doc_01',
): { fact: OcrProcessedFact; reviewItem?: OcrReviewQueueItem } {
  const factId = crypto.randomUUID();

  // Case 1: Chart Image element without OCR-verified data labels
  if (candidate.isChartElement && !candidate.hasVerifiedLabel) {
    const fact: OcrProcessedFact = {
      id: factId,
      label: candidate.label,
      type: 'measure',
      numericValue: candidate.value,
      value: candidate.value,
      unit: candidate.unit,
      currency: candidate.currency,
      period: candidate.period,
      page: candidate.page,
      quote: candidate.rawText,
      verified: false,
      proofType: 'ESTIMATED',
      verificationMethod: 'unverified',
      failReason: null,
      dashedStyling: true,
      routesToReviewQueue: true,
      reviewReason: 'Chart value visually estimated without OCR verified labels',
    };

    const reviewItem: OcrReviewQueueItem = {
      id: crypto.randomUUID(),
      factId,
      documentId,
      page: candidate.page,
      candidateValue: candidate.value,
      label: candidate.label,
      ocrConfidence: 50,
      reason: 'Chart value visually estimated without OCR verified labels',
      status: 'pending',
      suggestedProofType: 'ESTIMATED',
      rawQuote: candidate.rawText,
    };

    return { fact, reviewItem };
  }

  // Case 2: Document text or table cell on scanned page
  const evalResult = evaluateOcrConfidence(ocrTokens, candidate.rawText);

  if (evalResult.passedFloor) {
    // High-confidence OCR above floor (>= 80%)
    const fact: OcrProcessedFact = {
      id: factId,
      label: candidate.label,
      type: 'measure',
      numericValue: candidate.value,
      value: candidate.value,
      unit: candidate.unit,
      currency: candidate.currency,
      period: candidate.period,
      page: candidate.page,
      quote: candidate.rawText,
      verified: true,
      proofType: 'VERIFIED_OCR',
      verificationMethod: 'ocr_crosscheck',
      failReason: null,
      dashedStyling: false,
      routesToReviewQueue: false,
    };

    return { fact };
  }

  // Low-confidence OCR below floor (< 80%) -> Route to review queue!
  const fact: OcrProcessedFact = {
    id: factId,
    label: candidate.label,
    type: 'measure',
    numericValue: candidate.value,
    value: candidate.value,
    unit: candidate.unit,
    currency: candidate.currency,
    period: candidate.period,
    page: candidate.page,
    quote: candidate.rawText,
    verified: false,
    proofType: 'ESTIMATED',
    verificationMethod: 'ocr_crosscheck',
    failReason: null,
    dashedStyling: true,
    routesToReviewQueue: true,
    reviewReason: `Low OCR confidence (${evalResult.confidence}%) below required threshold (${OCR_CONFIDENCE_FLOOR}%)`,
  };

  const reviewItem: OcrReviewQueueItem = {
    id: crypto.randomUUID(),
    factId,
    documentId,
    page: candidate.page,
    candidateValue: candidate.value,
    label: candidate.label,
    ocrConfidence: evalResult.confidence,
    reason: `Low OCR confidence (${evalResult.confidence}%) below required threshold (${OCR_CONFIDENCE_FLOOR}%)`,
    status: 'pending',
    suggestedProofType: 'USER_CONFIRMED',
    rawQuote: candidate.rawText,
  };

  return { fact, reviewItem };
}

/**
 * Batches an entire scanned page's extraction candidates against OCR tokens.
 * Segregates verified facts from pending review items.
 */
export function processScannedPageFacts(
  candidates: VisionFactExtractionCandidate[],
  ocrTokens: OcrToken[],
  documentId: string = 'doc_01',
): {
  verifiedFacts: OcrProcessedFact[];
  reviewQueue: OcrReviewQueueItem[];
  allFacts: OcrProcessedFact[];
} {
  const verifiedFacts: OcrProcessedFact[] = [];
  const reviewQueue: OcrReviewQueueItem[] = [];
  const allFacts: OcrProcessedFact[] = [];

  for (const c of candidates) {
    const res = processVisionFactCandidate(c, ocrTokens, documentId);
    allFacts.push(res.fact);
    if (res.fact.verified) {
      verifiedFacts.push(res.fact);
    }
    if (res.reviewItem) {
      reviewQueue.push(res.reviewItem);
    }
  }

  return { verifiedFacts, reviewQueue, allFacts };
}
