import { z } from 'zod';
import { JobEventSchema, JobStageSchema, JobStatusSchema, DocumentStatusSchema } from './jobs.js';
import { VerificationMethodSchema } from './modality.js';

export const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB default
export const DEFAULT_MAX_PDF_PAGES = 50;
export const DEFAULT_MAX_TEXT_CHARS = 100000;

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  storagePath: z.string().min(1),
  fileSizeBytes: z.number().int().nonnegative(),
  sha256: z.string().length(64),
  mimeType: z.string().min(1),
  status: DocumentStatusSchema.default('queued'),
  pageCount: z.number().int().nonnegative().default(0),
  isSample: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Document = z.infer<typeof DocumentSchema>;

export const DocumentUploadResponseSchema = z.object({
  documentId: z.string().uuid(),
  jobId: z.string().uuid(),
  status: DocumentStatusSchema,
  filename: z.string(),
  fileSizeBytes: z.number().int().nonnegative(),
  sha256: z.string(),
  pageCount: z.number().int().nonnegative(),
});
export type DocumentUploadResponse = z.infer<typeof DocumentUploadResponseSchema>;

export const DocumentAnalysisDetailSchema = z.object({
  summary: z.string().nullable().optional(),
  documentType: z.string().optional(),
  keyFindings: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});
export type DocumentAnalysisDetail = z.infer<typeof DocumentAnalysisDetailSchema>;

/**
 * Guard ensuring that analysis synthesis text can only ever be produced
 * by a function that consumes strictly verified fact IDs (EVD-03 guard).
 */
export function assertAnalysisDerivedFromVerifiedFacts(params: {
  verifiedFactIds: string[];
  summary?: string | null;
  keyFindings?: string[];
}): void {
  if (
    (params.summary || (params.keyFindings && params.keyFindings.length > 0)) &&
    params.verifiedFactIds.length === 0
  ) {
    throw new Error(
      'FORBIDDEN_UNVERIFIED_SYNTHESIS: Analysis text cannot be generated without verified supporting fact IDs.',
    );
  }
}

export const FactTypeSchema = z.enum([
  'financial_total',
  'receipt',
  'expenditure',
  'allocation',
  'tax_collection',
  'physical_quantity',
  'count',
  'percentage',
]);
export type FactType = z.infer<typeof FactTypeSchema>;

export const FactPeriodSchema = z.object({
  basis: z.enum(['BE', 'RE', 'actual', 'none']),
  fiscalYear: z.string().nullable(),
});
export type FactPeriod = z.infer<typeof FactPeriodSchema>;

export const FactFailReasonSchema = z.enum([
  'HEADING_NUMBER',
  'YEAR_OR_DATE_AS_VALUE',
  'PAGE_OR_ID_NUMBER',
  'VALUE_NOT_IN_QUOTE',
  'UNIT_NOT_IN_QUOTE',
  'PERIOD_NOT_IN_QUOTE',
  'QUOTE_NOT_ON_SINGLE_PAGE',
  'MISSING_REQUIRED_UNIT',
  'PAGE_TEXT_MISSING',
]);
export type FactFailReason = z.infer<typeof FactFailReasonSchema>;

export const DocumentFactDetailSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  type: FactTypeSchema,
  value: z.number().nullable(),
  unit: z.string().nullable(),
  currency: z.string().nullable(),
  period: FactPeriodSchema.nullable(),
  page: z.number().int().positive(),
  quote: z.string(),
  verified: z.boolean(),
  verificationMethod: VerificationMethodSchema.default('quote_on_page'),
  failReason: FactFailReasonSchema.nullable().default(null),
});
export type DocumentFactDetail = z.infer<typeof DocumentFactDetailSchema>;

export const DocumentDetailResponseSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  status: DocumentStatusSchema,
  pageCount: z.number().int().nonnegative(),
  fileSizeBytes: z.number().int().nonnegative(),
  sha256: z.string(),
  isSample: z.boolean(),
  analysis: DocumentAnalysisDetailSchema.nullable().optional(),
  facts: z.array(DocumentFactDetailSchema).default([]),
  job: z
    .object({
      id: z.string().uuid(),
      status: JobStatusSchema,
      stage: JobStageSchema,
      progress: z.number().int().min(0).max(100),
    })
    .optional(),
});
export type DocumentDetailResponse = z.infer<typeof DocumentDetailResponseSchema>;

export const DocumentChunkSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  pageNumber: z.number().int().positive(),
  chunkIndex: z.number().int().nonnegative(),
  content: z.string(),
  similarity: z.number().optional(),
  rank: z.number().optional(),
});
export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;

export const DocumentChunksResponseSchema = z.object({
  documentId: z.string().uuid(),
  chunks: z.array(DocumentChunkSchema),
  total: z.number().int().nonnegative(),
});
export type DocumentChunksResponse = z.infer<typeof DocumentChunksResponseSchema>;

export const JobEventsListResponseSchema = z.object({
  documentId: z.string().uuid(),
  jobId: z.string().uuid(),
  events: z.array(JobEventSchema),
});
export type JobEventsListResponse = z.infer<typeof JobEventsListResponseSchema>;

export const DocumentListItemSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  status: DocumentStatusSchema,
  pageCount: z.number().int().nonnegative(),
  fileSizeBytes: z.number().int().nonnegative(),
  sha256: z.string(),
  isSample: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DocumentListItem = z.infer<typeof DocumentListItemSchema>;

export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentListItemSchema),
  total: z.number().int().nonnegative(),
});
export type DocumentListResponse = z.infer<typeof DocumentListResponseSchema>;

export const DocumentFileResponseSchema = z.object({
  documentId: z.string().uuid(),
  signedUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
});
export type DocumentFileResponse = z.infer<typeof DocumentFileResponseSchema>;
