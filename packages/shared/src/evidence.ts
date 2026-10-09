import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Span Kinds and Locators                                                    */
/* -------------------------------------------------------------------------- */

export const SpanKindSchema = z.enum([
  'text_span',
  'table_cell',
  'image_region',
  'csv_range',
  'geo_feature',
]);
export type SpanKind = z.infer<typeof SpanKindSchema>;

export const TextSpanLocatorSchema = z.object({
  pageNumber: z.number().int().positive(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  charRange: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(),
});
export type TextSpanLocator = z.infer<typeof TextSpanLocatorSchema>;

export const TableCellLocatorSchema = z.object({
  tableId: z.string(),
  row: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
  pageNumber: z.number().int().positive().optional(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});
export type TableCellLocator = z.infer<typeof TableCellLocatorSchema>;

export const ImageRegionLocatorSchema = z.object({
  imageId: z.string().optional(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  ocrConfidence: z.number().min(0).max(100).optional(),
});
export type ImageRegionLocator = z.infer<typeof ImageRegionLocatorSchema>;

export const CsvRangeLocatorSchema = z.object({
  column: z.string().min(1),
  rowStart: z.number().int().nonnegative(),
  rowEnd: z.number().int().nonnegative(),
  formula: z.string().optional(),
});
export type CsvRangeLocator = z.infer<typeof CsvRangeLocatorSchema>;

export const GeoFeatureLocatorSchema = z.object({
  layer: z.string().min(1),
  featureId: z.union([z.string(), z.number()]),
  propertyKey: z.string().min(1),
});
export type GeoFeatureLocator = z.infer<typeof GeoFeatureLocatorSchema>;

export const SpanLocatorSchema = z.union([
  TextSpanLocatorSchema,
  TableCellLocatorSchema,
  ImageRegionLocatorSchema,
  CsvRangeLocatorSchema,
  GeoFeatureLocatorSchema,
]);
export type SpanLocator = z.infer<typeof SpanLocatorSchema>;

export const EvidenceSpanSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  documentId: z.string().uuid(),
  kind: SpanKindSchema,
  locator: SpanLocatorSchema,
  text: z.string(),
  createdAt: z.string().optional(),
});
export type EvidenceSpan = z.infer<typeof EvidenceSpanSchema>;

/* -------------------------------------------------------------------------- */
/* Proof Types and Confidence Levels                                         */
/* -------------------------------------------------------------------------- */

export const ProofTypeSchema = z.enum([
  'VERIFIED', // Quote and numbers found verbatim/normalized in source text
  'VERIFIED_OCR', // Matched in OCR tokens at or above the confidence floor
  'COMPUTED', // Recomputed by two independent code paths (CSV, geo)
  'DERIVED', // Arithmetic from verified facts (growth rate, share, sum)
  'USER_CONFIRMED', // Low-confidence item a human approved
  'ESTIMATED', // Read from a chart image or low-quality scan
  'CONFLICT', // Two verified sources disagree
  'UNVERIFIABLE', // Cannot be proven
  'REJECTED', // Fails verification check
]);
export type ProofType = z.infer<typeof ProofTypeSchema>;

/**
 * Returns true if the proof type qualifies for inclusion in overview visual cards.
 */
export function isOverviewEligibleProofType(
  proofType: ProofType,
  includeEstimates = false,
): boolean {
  switch (proofType) {
    case 'VERIFIED':
    case 'VERIFIED_OCR':
    case 'COMPUTED':
    case 'DERIVED':
      return true;
    case 'USER_CONFIRMED':
    case 'ESTIMATED':
      return includeEstimates;
    case 'CONFLICT':
    case 'UNVERIFIABLE':
    case 'REJECTED':
      return false;
  }
}

export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'review']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

/* -------------------------------------------------------------------------- */
/* Advanced Fact Types                                                        */
/* -------------------------------------------------------------------------- */

export const AdvancedFactTypeSchema = z.enum([
  'money',
  'measure',
  'date_span',
  'place',
  'entity',
  'obligation',
  'definition',
  'relation',
]);
export type AdvancedFactType = z.infer<typeof AdvancedFactTypeSchema>;

export const EstimateTypeSchema = z.enum(['budget', 'revised', 'actual', 'none']);
export type EstimateType = z.infer<typeof EstimateTypeSchema>;

/* -------------------------------------------------------------------------- */
/* Entities & Relations                                                       */
/* -------------------------------------------------------------------------- */

export const EntityKindSchema = z.enum([
  'ministry',
  'department',
  'company',
  'act',
  'scheme',
  'agency',
  'person',
  'program',
]);
export type EntityKind = z.infer<typeof EntityKindSchema>;

export const EntitySchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  kind: EntityKindSchema,
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  gazetteerId: z.string().nullable().optional(),
});
export type Entity = z.infer<typeof EntitySchema>;

export const RelationPredicateSchema = z.enum([
  'allocates_to',
  'amends',
  'funds',
  'part_of',
  'effective_from',
  'implemented_by',
  'oversees',
  'reports_to',
]);
export type RelationPredicate = z.infer<typeof RelationPredicateSchema>;

export const RelationSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  predicate: RelationPredicateSchema,
  objectId: z.string().uuid(),
  factIds: z.array(z.string().uuid()).min(1),
});
export type Relation = z.infer<typeof RelationSchema>;

/* -------------------------------------------------------------------------- */
/* Derived Facts, Reconciliations & Flags                                     */
/* -------------------------------------------------------------------------- */

export const DerivedFactSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  formula: z.string().min(1),
  sourceFactIds: z.array(z.string().uuid()).min(1),
  label: z.string().min(1),
  value: z.number(),
  unit: z.string().nullable().optional(),
  proofType: z.literal('DERIVED').default('DERIVED'),
});
export type DerivedFact = z.infer<typeof DerivedFactSchema>;

export const ReconciliationKindSchema = z.enum([
  'sum_of_parts',
  'year_over_year_balance',
  'budget_to_actual',
  'cross_page_duplicate',
]);
export type ReconciliationKind = z.infer<typeof ReconciliationKindSchema>;

export const ReconciliationStatusSchema = z.enum([
  'reconciled',
  'discrepancy_found',
  'conflict_detected',
]);
export type ReconciliationStatus = z.infer<typeof ReconciliationStatusSchema>;

export const ReconciliationSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  kind: ReconciliationKindSchema,
  status: ReconciliationStatusSchema,
  sourceFactIds: z.array(z.string().uuid()).min(1),
  statedTotal: z.number().optional(),
  computedTotal: z.number().optional(),
  delta: z.number().optional(),
  detail: z.string().min(1),
});
export type Reconciliation = z.infer<typeof ReconciliationSchema>;

export const FlagSeveritySchema = z.enum(['info', 'warning', 'critical']);
export type FlagSeverity = z.infer<typeof FlagSeveritySchema>;

export const FlagRuleSchema = z.enum([
  'ALLOCATION_DROP_SIGNIFICANT',
  'SUM_DISCREPANCY',
  'UPCOMING_DEADLINE',
  'ESTIMATE_NOT_ACTUAL',
  'CONFLICTING_VALUES',
  'LOW_STRUCTURE_CONFIDENCE',
]);
export type FlagRule = z.infer<typeof FlagRuleSchema>;

export const FlagSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  rule: FlagRuleSchema,
  severity: FlagSeveritySchema,
  sourceFactIds: z.array(z.string().uuid()).min(1),
  text: z.string().min(1),
  createdAt: z.string().optional(),
});
export type Flag = z.infer<typeof FlagSchema>;

/* -------------------------------------------------------------------------- */
/* Review Queue                                                               */
/* -------------------------------------------------------------------------- */

export const ReviewQueueStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ReviewQueueStatus = z.infer<typeof ReviewQueueStatusSchema>;

export const ReviewQueueItemSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  factId: z.string().uuid(),
  reason: z.string().min(1),
  ocrConfidence: z.number().optional(),
  status: ReviewQueueStatusSchema.default('pending'),
  reviewedBy: z.string().uuid().nullable().optional(),
  reviewedAt: z.string().nullable().optional(),
  label: z.string().optional(),
  rawQuote: z.string().optional(),
});
export type ReviewQueueItem = z.infer<typeof ReviewQueueItemSchema>;

export const ReviewQueueListResponseSchema = z.object({
  items: z.array(ReviewQueueItemSchema),
});
export type ReviewQueueListResponse = z.infer<typeof ReviewQueueListResponseSchema>;

export const ReviewActionResponseSchema = z.object({
  success: z.boolean(),
  item: ReviewQueueItemSchema,
});
export type ReviewActionResponse = z.infer<typeof ReviewActionResponseSchema>;

export const ConflictDetailSchema = z.object({
  id: z.string(),
  subject: z.string(),
  period: z.string().nullable(),
  sourceA: z.object({
    factId: z.string(),
    page: z.number(),
    value: z.number(),
    quote: z.string(),
  }),
  sourceB: z.object({
    factId: z.string(),
    page: z.number(),
    value: z.number(),
    quote: z.string(),
  }),
  difference: z.number(),
});
export type ConflictDetail = z.infer<typeof ConflictDetailSchema>;

export const ConflictsResponseSchema = z.object({
  conflicts: z.array(ConflictDetailSchema),
});
export type ConflictsResponse = z.infer<typeof ConflictsResponseSchema>;

export const GlossaryItemSchema = z.object({
  id: z.string(),
  term: z.string(),
  definition: z.string(),
  page: z.number(),
  quote: z.string(),
  factId: z.string(),
});
export type GlossaryItem = z.infer<typeof GlossaryItemSchema>;

export const GlossaryResponseSchema = z.object({
  terms: z.array(GlossaryItemSchema),
});
export type GlossaryResponse = z.infer<typeof GlossaryResponseSchema>;
