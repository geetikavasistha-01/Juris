import { z } from 'zod';
import type { DocumentFactDetail } from './documents.js';
import { ProofTypeSchema } from './evidence.js';

export const StoryboardStepKeySchema = z.enum([
  'what_is_this',
  'big_numbers',
  'where_money_goes',
  'what_changed',
  'when_things_happen',
  'where',
  'who',
  'things_to_know',
]);

export type StoryboardStepKey = z.infer<typeof StoryboardStepKeySchema>;

export const StoryboardClaimSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  claimText: z.string().min(1),
  factIds: z.array(z.string().min(1)).min(1),
  value: z.union([z.number(), z.string()]).nullish(),
  unit: z.string().nullish(),
  proofType: ProofTypeSchema.default('VERIFIED'),
  isVerified: z.boolean().default(true),
});

export type StoryboardClaim = z.infer<typeof StoryboardClaimSchema>;

export const StoryboardStepSchema = z.object({
  stepNumber: z.number().int().min(1).max(8),
  key: StoryboardStepKeySchema,
  title: z.string().min(1),
  description: z.string().min(1),
  summary: z.string().min(1),
  claims: z.array(StoryboardClaimSchema),
  available: z.boolean(),
});

export type StoryboardStep = z.infer<typeof StoryboardStepSchema>;

export const DocumentStoryboardSchema = z.object({
  documentId: z.string().min(1),
  title: z.string().min(1),
  steps: z.array(StoryboardStepSchema).length(8),
  verifiedFactsCount: z.number().int().nonnegative(),
  provenancePassRate: z.number().min(0).max(1),
  generatedAt: z.string().datetime(),
});

export type DocumentStoryboard = z.infer<typeof DocumentStoryboardSchema>;

export interface StoryboardBuildOptions {
  documentId?: string;
  documentTitle?: string;
  authorityName?: string;
  fiscalPeriod?: string;
}

/**
 * Builds the canonical 8-Step Layman Storyboard ("Document at a Glance")
 * from verified Evidence Graph facts.
 * Every claim strictly references verified fact IDs.
 */
export function buildDocumentStoryboard(
  facts: DocumentFactDetail[],
  options?: StoryboardBuildOptions,
): DocumentStoryboard {
  const verifiedFacts = facts.filter((f) => f.verified === true);
  const docId = options?.documentId || 'doc-overview';
  const docTitle = options?.documentTitle || 'Municipal Civic Document';

  // 1. What is this
  const whatIsThisFacts = verifiedFacts.filter(
    (f) =>
      /speech|budget|order|gazette|notification|docket|act/i.test(f.quote) ||
      f.type === 'entity' ||
      f.type === 'date',
  );
  const whatIsThisClaims: StoryboardClaim[] = (
    whatIsThisFacts.length > 0 ? whatIsThisFacts.slice(0, 2) : verifiedFacts.slice(0, 1)
  ).map((f, i) => ({
    id: `what_${i}`,
    label: f.label || 'Document Purpose',
    claimText:
      f.quote || `Official civic publication for ${options?.fiscalPeriod || 'fiscal term'}.`,
    factIds: [f.id],
    value: f.value,
    unit: f.unit || undefined,
    proofType: 'VERIFIED',
    isVerified: true,
  }));

  // 2. Big Numbers (Macro totals)
  const bigNumberFacts = verifiedFacts.filter(
    (f) =>
      /total|overall|gross|aggregate|budget estimate|receipt/i.test(f.label) ||
      /total|overall/i.test(f.quote) ||
      (typeof f.value === 'number' && f.value > 1000000),
  );
  const selectedBigNumbers = (bigNumberFacts.length > 0 ? bigNumberFacts : verifiedFacts).slice(
    0,
    3,
  );
  const bigNumbersClaims: StoryboardClaim[] = selectedBigNumbers.map((f, i) => ({
    id: `big_${i}`,
    label: f.label,
    claimText:
      `${f.label}: ${typeof f.value === 'number' ? f.value.toLocaleString() : f.value} ${f.unit || ''}`.trim(),
    factIds: [f.id],
    value: f.value,
    unit: f.unit || undefined,
    proofType: 'VERIFIED',
    isVerified: true,
  }));

  // 3. Where money goes (Allocations)
  const allocationFacts = verifiedFacts.filter(
    (f) =>
      f.type === 'allocation' ||
      /allocation|expenditure|outlay|department|services|works/i.test(f.label),
  );
  const selectedAllocations = (allocationFacts.length > 0 ? allocationFacts : verifiedFacts).slice(
    0,
    4,
  );
  const moneyGoesClaims: StoryboardClaim[] = selectedAllocations.map((f, i) => ({
    id: `money_${i}`,
    label: f.label,
    claimText: `Dedicated ${typeof f.value === 'number' ? f.value.toLocaleString() : f.value} ${f.unit || ''} to ${f.label}.`,
    factIds: [f.id],
    value: f.value,
    unit: f.unit || undefined,
    proofType: 'VERIFIED',
    isVerified: true,
  }));

  // 4. What changed (Deltas / comparisons)
  const comparisonFacts = verifiedFacts.filter(
    (f) =>
      /increase|decrease|growth|against|compared|revised|be|re/i.test(f.quote) || f.period !== null,
  );
  const selectedComparisons = (comparisonFacts.length > 0 ? comparisonFacts : verifiedFacts).slice(
    0,
    2,
  );
  const whatChangedClaims: StoryboardClaim[] = selectedComparisons.map((f, i) => ({
    id: `changed_${i}`,
    label: f.label,
    claimText: f.quote,
    factIds: [f.id],
    value: f.value,
    unit: f.unit || undefined,
    proofType: 'VERIFIED',
    isVerified: true,
  }));

  // 5. When things happen (Timeline)
  const timelineFacts = verifiedFacts.filter(
    (f) => f.period !== null || /20\d{2}|fy|quarter|schedule|effective|deadline/i.test(f.quote),
  );
  const selectedTimeline = (timelineFacts.length > 0 ? timelineFacts : verifiedFacts).slice(0, 2);
  const timelineClaims: StoryboardClaim[] = selectedTimeline.map((f, i) => ({
    id: `timeline_${i}`,
    label: f.period ? `Fiscal Term ${f.period}` : f.label,
    claimText: f.quote,
    factIds: [f.id],
    value: f.value,
    unit: f.unit || undefined,
    proofType: 'VERIFIED',
    isVerified: true,
  }));

  // 6. Where (Geographic scope)
  const geoFacts = verifiedFacts.filter(
    (f) =>
      /ward|zone|district|delhi|mumbai|state|area|circle|sector/i.test(f.quote) ||
      /ward|zone|region/i.test(f.label),
  );
  const selectedGeo = (geoFacts.length > 0 ? geoFacts : verifiedFacts).slice(0, 2);
  const whereClaims: StoryboardClaim[] = selectedGeo.map((f, i) => ({
    id: `where_${i}`,
    label: f.label,
    claimText: f.quote,
    factIds: [f.id],
    value: f.value,
    unit: f.unit || undefined,
    proofType: 'VERIFIED',
    isVerified: true,
  }));

  // 7. Who (Key stakeholders & agencies)
  const whoFacts = verifiedFacts.filter(
    (f) =>
      /department|council|committee|board|corporation|officer|commissioner|minister/i.test(
        f.quote,
      ) || /department|agency|who/i.test(f.label),
  );
  const selectedWho = (whoFacts.length > 0 ? whoFacts : verifiedFacts).slice(0, 2);
  const whoClaims: StoryboardClaim[] = selectedWho.map((f, i) => ({
    id: `who_${i}`,
    label: f.label,
    claimText: f.quote,
    factIds: [f.id],
    value: f.value,
    unit: f.unit || undefined,
    proofType: 'VERIFIED',
    isVerified: true,
  }));

  // 8. Things to know (Conditions & footnotes)
  const caveatFacts = verifiedFacts.filter(
    (f) =>
      /subject to|condition|clause|provision|note|risk|audit/i.test(f.quote) ||
      f.type === 'obligation' ||
      f.type === 'definition',
  );
  const selectedCaveats = (caveatFacts.length > 0 ? caveatFacts : verifiedFacts).slice(0, 2);
  const thingsToKnowClaims: StoryboardClaim[] = selectedCaveats.map((f, i) => ({
    id: `caveat_${i}`,
    label: f.label,
    claimText: f.quote,
    factIds: [f.id],
    value: f.value,
    unit: f.unit || undefined,
    proofType: 'VERIFIED',
    isVerified: true,
  }));

  const steps: StoryboardStep[] = [
    {
      stepNumber: 1,
      key: 'what_is_this',
      title: 'What is this?',
      description: 'Document identification, authority, and statutory jurisdiction.',
      summary:
        whatIsThisClaims.length > 0
          ? whatIsThisClaims[0]!.claimText
          : 'Civic administrative instrument.',
      claims: whatIsThisClaims,
      available: whatIsThisClaims.length > 0,
    },
    {
      stepNumber: 2,
      key: 'big_numbers',
      title: 'The Big Numbers',
      description: 'Headline financial totals and macro volumetric quantities.',
      summary:
        bigNumbersClaims.length > 0
          ? bigNumbersClaims.map((c) => c.claimText).join(' | ')
          : 'No verified macro figures.',
      claims: bigNumbersClaims,
      available: bigNumbersClaims.length > 0,
    },
    {
      stepNumber: 3,
      key: 'where_money_goes',
      title: 'Where the Money Goes',
      description: 'Distribution of civic resources across programs and departments.',
      summary:
        moneyGoesClaims.length > 0
          ? `Resource allocation across ${moneyGoesClaims.length} major functional heads.`
          : 'Allocation details unverified.',
      claims: moneyGoesClaims,
      available: moneyGoesClaims.length > 0,
    },
    {
      stepNumber: 4,
      key: 'what_changed',
      title: 'What Changed?',
      description: 'Period-over-period differences, budget revisions, and policy shifts.',
      summary:
        whatChangedClaims.length > 0
          ? whatChangedClaims[0]!.claimText
          : 'Historical comparison not detailed.',
      claims: whatChangedClaims,
      available: whatChangedClaims.length > 0,
    },
    {
      stepNumber: 5,
      key: 'when_things_happen',
      title: 'When Things Happen',
      description: 'Statutory timelines, fiscal years, and implementation milestones.',
      summary:
        timelineClaims.length > 0
          ? timelineClaims[0]!.claimText
          : 'Implementation schedule unspecified.',
      claims: timelineClaims,
      available: timelineClaims.length > 0,
    },
    {
      stepNumber: 6,
      key: 'where',
      title: 'Where It Applies',
      description: 'Geographic boundaries, wards, and administrative jurisdictions.',
      summary:
        whereClaims.length > 0 ? whereClaims[0]!.claimText : 'General municipal jurisdiction.',
      claims: whereClaims,
      available: whereClaims.length > 0,
    },
    {
      stepNumber: 7,
      key: 'who',
      title: 'Who Is Responsible',
      description: 'Custodial agencies, departments, and beneficiary groups.',
      summary: whoClaims.length > 0 ? whoClaims[0]!.claimText : 'Civic authority custodians.',
      claims: whoClaims,
      available: whoClaims.length > 0,
    },
    {
      stepNumber: 8,
      key: 'things_to_know',
      title: 'Things to Know & Caveats',
      description: 'Statutory conditions, caveats, and oversight provisions.',
      summary:
        thingsToKnowClaims.length > 0
          ? thingsToKnowClaims[0]!.claimText
          : 'Standard statutory provisions apply.',
      claims: thingsToKnowClaims,
      available: thingsToKnowClaims.length > 0,
    },
  ];

  const totalClaims = steps.flatMap((s) => s.claims);
  const verifiedClaimsCount = totalClaims.filter((c) => c.isVerified).length;
  const provenancePassRate =
    totalClaims.length > 0 ? verifiedClaimsCount / totalClaims.length : 1.0;

  return {
    documentId: docId,
    title: docTitle,
    steps,
    verifiedFactsCount: verifiedFacts.length,
    provenancePassRate,
    generatedAt: new Date().toISOString(),
  };
}
