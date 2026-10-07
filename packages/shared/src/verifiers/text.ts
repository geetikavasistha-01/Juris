import type { FactPeriod, FactType } from '../documents.js';
import type { ProofType } from '../evidence.js';
import {
  verifyFactQuoteAndValue,
  type FactVerificationInput,
  type FactVerificationResult,
} from '../text-normalization.js';

export interface TextVerificationResult extends FactVerificationResult {
  proofType: ProofType;
  confidenceScore: number;
}

/**
 * Mechanically verifies a proposed text-layer fact against the raw page text.
 * Returns a standardized v2 TextVerificationResult with assigned ProofType.
 */
export function verifyTextSpanFact(
  pageText: string,
  fact: {
    quote: string;
    label?: string;
    type?: FactType | string;
    value?: number | null;
    unit?: string | null;
    period?: FactPeriod | string | null;
    page?: number;
  },
): TextVerificationResult {
  const verificationInput: FactVerificationInput = {
    quote: fact.quote,
    label: fact.label,
    type: fact.type,
    value: fact.value,
    unit: fact.unit,
    period: fact.period,
    page: fact.page ?? 1,
  };

  const baseResult = verifyFactQuoteAndValue(pageText, verificationInput);

  let proofType: ProofType;
  let confidenceScore = 0;

  if (baseResult.verified) {
    proofType = 'VERIFIED';
    confidenceScore = baseResult.exactMatch ? 1.0 : 0.95;
  } else if (baseResult.failReason === 'PAGE_TEXT_MISSING') {
    proofType = 'UNVERIFIABLE';
    confidenceScore = 0;
  } else {
    proofType = 'REJECTED';
    confidenceScore = baseResult.quoteMatched ? 0.3 : 0;
  }

  return {
    ...baseResult,
    proofType,
    confidenceScore,
  };
}
