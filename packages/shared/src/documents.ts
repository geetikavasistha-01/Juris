import { z } from 'zod';
import { JobEventSchema, JobStageSchema, JobStatusSchema } from './jobs.js';
import { VerificationMethodSchema } from './modality.js';

export const DocumentStatusSchema = z.enum(['queued', 'processing', 'done', 'failed']);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

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
  summary: z.string().optional(),
  documentType: z.string().optional(),
  keyFindings: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});
export type DocumentAnalysisDetail = z.infer<typeof DocumentAnalysisDetailSchema>;

export const DocumentFactDetailSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  currency: z.string().nullable(),
  period: z.string().nullable(),
  page: z.number().int().positive(),
  quote: z.string(),
  verified: z.boolean(),
  verificationMethod: VerificationMethodSchema.default('quote_on_page'),
  failReason: z.string().nullable().default(null),
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
