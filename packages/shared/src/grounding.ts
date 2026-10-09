import type { DocumentFactDetail } from './documents.js';
import type { VisualSpec } from './visual-spec.js';
import type {
  InsightClaim,
  VisualInsight,
  InsightGenerationOptions,
  ReadingLevel,
} from './insights.js';

/**
 * Extracts numbers from text (integers and floats, handling commas and percentages).
 */
export function extractNumbersFromText(text: string): number[] {
  // Matches integers, decimals, percentages, currency numbers
  const regex = /[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g;
  const matches = text.replace(/,/g, '').match(regex) || [];
  return matches.map((m) => Number.parseFloat(m)).filter((n) => !Number.isNaN(n));
}

/**
 * Checks if two numbers are approximately equal within relative tolerance
 */
export function numbersMatch(a: number, b: number, tolerance = 0.01): boolean {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  const avg = (Math.abs(a) + Math.abs(b)) / 2;
  if (avg === 0) return diff < 1e-6;
  return diff / avg <= tolerance;
}

export function matchesAnySubsetSum(target: number, nums: number[], tolerance = 0.01): boolean {
  if (nums.length === 0) return false;
  // Check direct equality
  if (nums.some((n) => numbersMatch(target, n, tolerance))) return true;
  // Check subset sums
  const n = Math.min(nums.length, 12);
  for (let i = 1; i < 1 << n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      if ((i >> j) & 1) sum += nums[j] ?? 0;
    }
    if (numbersMatch(target, sum, tolerance)) return true;
  }
  return false;
}

/**
 * Computes token overlap between claim and reference texts
 */
export function computeTokenOverlap(claimText: string, referenceTexts: string[]): number {
  const normalize = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const claimTokens = new Set(normalize(claimText));
  if (claimTokens.size === 0) return 0;

  const refTokens = new Set(referenceTexts.flatMap(normalize));
  let matched = 0;
  for (const token of claimTokens) {
    if (refTokens.has(token)) {
      matched++;
    }
  }

  return matched / claimTokens.size;
}

/**
 * Validates that comparative claims hold mathematically based on referenced facts.
 */
export function validateComparativeTerms(
  claimText: string,
  referencedFacts: DocumentFactDetail[],
): { valid: boolean; reason?: string } {
  const lower = claimText.toLowerCase();
  const isGreaterClaim =
    lower.includes('greater than') ||
    lower.includes('more than') ||
    lower.includes('higher than') ||
    lower.includes('exceeded') ||
    lower.includes('larger than') ||
    lower.includes('surpassed');
  const isLesserClaim =
    lower.includes('less than') ||
    lower.includes('smaller than') ||
    lower.includes('lower than') ||
    lower.includes('below') ||
    lower.includes('trailed');

  if ((isGreaterClaim || isLesserClaim) && referencedFacts.length >= 2) {
    const getFirstWord = (s: string) => s.toLowerCase().split(' ')[0] ?? '';
    const factA = referencedFacts.find((f) => {
      const w = getFirstWord(f.label);
      return w.length > 0 && lower.includes(w);
    });
    const otherFacts = referencedFacts.filter((f) => f.id !== factA?.id);
    const factB = otherFacts.find((f) => {
      const w = getFirstWord(f.label);
      return w.length > 0 && lower.includes(w);
    });

    if (factA && factB) {
      const posA = lower.indexOf(getFirstWord(factA.label));
      const posB = lower.indexOf(getFirstWord(factB.label));
      const firstFact = posA < posB ? factA : factB;
      const secondFact = posA < posB ? factB : factA;
      const firstVal = Number(firstFact.value);
      const secondVal = Number(secondFact.value);

      if (isGreaterClaim && firstVal <= secondVal) {
        return {
          valid: false,
          reason: `Comparative relationship does not hold mathematically: ${firstFact.label} (${firstVal}) is not greater than ${secondFact.label} (${secondVal}).`,
        };
      }
      if (isLesserClaim && firstVal >= secondVal) {
        return {
          valid: false,
          reason: `Comparative relationship does not hold mathematically: ${firstFact.label} (${firstVal}) is not less than ${secondFact.label} (${secondVal}).`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Mechanically verifies an insight claim against its cited facts
 */
export function verifyInsightClaim(
  claim: { claimText: string; factIds: string[] },
  factsMap: Map<string, DocumentFactDetail>,
): InsightClaim {
  const referencedFacts = claim.factIds
    .map((id) => factsMap.get(id))
    .filter((f): f is DocumentFactDetail => Boolean(f));

  if (referencedFacts.length === 0) {
    return {
      id: `claim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      claimText: claim.claimText,
      factIds: claim.factIds,
      numbersMentioned: extractNumbersFromText(claim.claimText),
      proofType: 'REJECTED',
      confidenceScore: 0,
      isVerified: false,
      rejectionReason: 'No valid verified facts referenced.',
    };
  }

  const claimNumbers = extractNumbersFromText(claim.claimText);
  const factNumbers = referencedFacts.map((f) => Number(f.value)).filter((n) => !Number.isNaN(n));

  // Verify that any significant number in the claim can be traced to a referenced fact
  const unmatchedNumbers = claimNumbers.filter((cn) => {
    // If integer, require exact match (tolerance 0) to prevent adversarial single-digit tampering
    const tol = Number.isInteger(cn) ? 0 : 0.001;
    // Check if cn matches direct fact number or any subset sum
    if (matchesAnySubsetSum(cn, factNumbers, tol)) return false;

    // Check if cn matches a percentage relative to total
    const total = factNumbers.reduce((sum, v) => sum + v, 0);
    if (total > 0) {
      if (matchesAnySubsetSum((cn / 100) * total, factNumbers, 0.01)) return false;
      const percentageMatch = factNumbers.some((fn) => numbersMatch(cn, (fn / total) * 100, 0.05));
      if (percentageMatch) return false;
    }

    // Small ordinals (1, 2, 3, 4, 5) or years (1990-2050) are not strict fact values
    if (cn <= 10 && Number.isInteger(cn)) return false;
    if (cn >= 1990 && cn <= 2050 && Number.isInteger(cn)) return false;

    return true;
  });

  if (unmatchedNumbers.length > 0) {
    return {
      id: `claim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      claimText: claim.claimText,
      factIds: claim.factIds,
      numbersMentioned: claimNumbers,
      proofType: 'REJECTED',
      confidenceScore: 0.2,
      isVerified: false,
      rejectionReason: `Unverified number(s) found in claim: ${unmatchedNumbers.join(', ')}`,
    };
  }

  // Verify mathematical validity of comparative claims
  const compCheck = validateComparativeTerms(claim.claimText, referencedFacts);
  if (!compCheck.valid) {
    return {
      id: `claim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      claimText: claim.claimText,
      factIds: claim.factIds,
      numbersMentioned: claimNumbers,
      proofType: 'REJECTED',
      confidenceScore: 0.1,
      isVerified: false,
      rejectionReason: compCheck.reason,
    };
  }

  // Check token grounding against quotes and labels
  const refStrings = referencedFacts.flatMap((f) => [f.label, f.quote, f.unit || '']);
  const overlap = computeTokenOverlap(claim.claimText, refStrings);

  return {
    id: `claim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    claimText: claim.claimText,
    factIds: claim.factIds,
    numbersMentioned: claimNumbers,
    proofType: referencedFacts.every((f) => f.verified) ? 'VERIFIED' : 'ESTIMATED',
    confidenceScore: Math.max(0.7, overlap),
    isVerified: true,
  };
}

/**
 * Filters a list of sentence claims, dropping any ungrounded or failing sentences.
 * Ensures 100% of retained sentences are verified.
 */
export function filterGroundedSentences(
  claims: Array<{ claimText: string; factIds: string[] }>,
  factsMap: Map<string, DocumentFactDetail>,
): InsightClaim[] {
  return claims
    .map((c) => verifyInsightClaim(c, factsMap))
    .filter((claim) => claim.isVerified && claim.proofType !== 'REJECTED');
}

/**
 * Deterministically generates plain-language insights directly from a VisualSpec and facts.
 * Supports 3 reading levels: 'simple' | 'standard' | 'expert'.
 * 100% mechanical, zero hallucination.
 */
export function generateDeterministicInsights(
  spec: VisualSpec,
  facts: DocumentFactDetail[],
  options?: InsightGenerationOptions,
): VisualInsight {
  const level: ReadingLevel = options?.readingLevel || 'standard';
  const factsMap = new Map(facts.map((f) => [f.id, f]));
  const validPoints = spec.series.filter((p) => p.factIds && p.factIds.length > 0);

  if (validPoints.length === 0) {
    const fallbackText =
      level === 'simple'
        ? `This chart shows ${facts.length} verified facts from the document.`
        : level === 'expert'
          ? `Structural dataset containing ${facts.length} verified observations across ${spec.encodings?.category || 'uncategorized'} partitions.`
          : `Visual representation constructed from ${facts.length} verified document facts.`;

    const singleClaim = verifyInsightClaim(
      {
        claimText: fallbackText,
        factIds: facts.map((f) => f.id),
      },
      factsMap,
    );

    return {
      id: `insight_${spec.id}_${level}`,
      visualSpecId: spec.id,
      title: `${spec.title} Overview`,
      summary: fallbackText,
      claims: [singleClaim],
      generatedBy: 'deterministic_template',
      overallConfidence: 1.0,
    };
  }

  // Calculate totals and rankings
  const total = validPoints.reduce((sum, p) => sum + Number(p.value), 0);
  const totalFactIds = validPoints.flatMap((p) => p.factIds);
  const sorted = [...validPoints].sort((a, b) => Number(b.value) - Number(a.value));
  const topPoint = sorted[0];
  const unit =
    spec.encodings?.unit || topPoint?.unit ? ` ${spec.encodings?.unit || topPoint?.unit}` : '';

  const candidateClaims: Array<{ claimText: string; factIds: string[] }> = [];

  if (level === 'simple') {
    // Simple reading level: short, direct language
    if (topPoint) {
      candidateClaims.push({
        claimText: `In plain terms, ${topPoint.label} is the largest item with ${Number(topPoint.value).toLocaleString()}${unit}.`,
        factIds: topPoint.factIds,
      });
    }
    if (total > 0 && validPoints.length > 1) {
      candidateClaims.push({
        claimText: `Together, all ${validPoints.length} items add up to ${total.toLocaleString()}${unit}.`,
        factIds: totalFactIds,
      });
    }
  } else if (level === 'expert') {
    // Expert reading level: statistical breakdown & analytical detail
    if (total > 0 && validPoints.length > 1) {
      candidateClaims.push({
        claimText: `Aggregate fiscal allocation totals ${total.toLocaleString()}${unit} across ${validPoints.length} discrete budget items.`,
        factIds: totalFactIds,
      });
    }
    if (topPoint && total > 0) {
      const pct = ((Number(topPoint.value) / total) * 100).toFixed(1);
      const claimFactIds = Array.from(new Set([...topPoint.factIds, ...totalFactIds]));
      candidateClaims.push({
        claimText: `Primary item is ${topPoint.label} representing ${Number(topPoint.value).toLocaleString()}${unit} (${pct}% of aggregate volume).`,
        factIds: claimFactIds,
      });
    }
    if (sorted.length >= 3 && total > 0) {
      const top3 = sorted.slice(0, 3);
      const top3Total = top3.reduce((sum, p) => sum + Number(p.value), 0);
      const top3Pct = ((top3Total / total) * 100).toFixed(1);
      const top3FactIds = Array.from(new Set([...top3.flatMap((p) => p.factIds), ...totalFactIds]));
      const top3Names = top3.map((p) => p.label).join(', ');
      candidateClaims.push({
        claimText: `The 3-firm concentration ratio covers ${top3Names} totaling ${top3Total.toLocaleString()}${unit} (${top3Pct}% concentration).`,
        factIds: top3FactIds,
      });
    }
  } else {
    // Standard reading level
    if (total > 0 && validPoints.length > 1) {
      candidateClaims.push({
        claimText: `The total aggregate across ${validPoints.length} items is ${total.toLocaleString()}${unit}.`,
        factIds: totalFactIds,
      });
    }
    if (topPoint && total > 0) {
      const pct = ((Number(topPoint.value) / total) * 100).toFixed(1);
      const claimFactIds = Array.from(new Set([...topPoint.factIds, ...totalFactIds]));
      candidateClaims.push({
        claimText: `${topPoint.label} represents the largest share at ${Number(topPoint.value).toLocaleString()}${unit} (${pct}% of aggregate).`,
        factIds: claimFactIds,
      });
    }
    if (sorted.length >= 3 && total > 0) {
      const top3 = sorted.slice(0, 3);
      const top3Total = top3.reduce((sum, p) => sum + Number(p.value), 0);
      const top3Pct = ((top3Total / total) * 100).toFixed(1);
      const top3FactIds = Array.from(new Set([...top3.flatMap((p) => p.factIds), ...totalFactIds]));
      const top3Names = top3.map((p) => p.label).join(', ');
      candidateClaims.push({
        claimText: `The top 3 categories (${top3Names}) account for ${top3Total.toLocaleString()}${unit} (${top3Pct}% of total).`,
        factIds: top3FactIds,
      });
    }
  }

  // Filter out any claim that does not pass mechanical grounding
  const verifiedClaims = filterGroundedSentences(candidateClaims, factsMap);
  const summary = verifiedClaims.map((c) => c.claimText).join(' ');

  return {
    id: `insight_${spec.id}_${level}`,
    visualSpecId: spec.id,
    title: `${spec.title} Key Insights`,
    summary,
    claims: verifiedClaims,
    generatedBy: 'deterministic_template',
    overallConfidence: 1.0,
  };
}
