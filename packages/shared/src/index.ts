import { z } from 'zod';

/**
 * Closed list of error codes specified in the Juris PRD (Sections 5, 8, 9.3).
 */
export const ErrorCodeSchema = z.enum([
  'LLM_KEY_INVALID',
  'LLM_QUOTA',
  'LLM_BLOCKED',
  'FILE_TYPE',
  'FILE_TOO_LARGE',
  'DUPLICATE',
  'NOT_FOUND',
  'AUTH_REQUIRED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'VALIDATION_ERROR',
  'PROCESSING_FAILED',
  'DOCUMENT_EXPIRED',
  'INTERNAL_ERROR',
  'EMPTY_RESPONSE',
  'TRUNCATED_RESPONSE',
  // Modality & multi-modal ingestion error codes (ING-05..08, EVD-06, VIZ-07, CHT-05)
  'UNSUPPORTED_FORMAT',
  'MAGIC_BYTES_MISMATCH',
  'IMAGE_DIMENSIONS_EXCEEDED',
  'ARCHIVE_TOO_LARGE',
  'TABLE_LIMIT_EXCEEDED',
  'OCR_DISAGREEMENT',
  'INVALID_QUERY_PLAN',
  'INVALID_GEOMETRY',
  'GEO_FEATURE_LIMIT_EXCEEDED',
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/**
 * Canonical error envelope for all Juris API responses:
 * { error: { code, message, details? } }
 */
export const ErrorDetailSchema = z.record(z.string(), z.unknown());

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: ErrorDetailSchema.optional(),
  }),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

/**
 * Health endpoint response schema:
 * GET /health -> { status: "ok", role, version, gitSha }
 */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  role: z.enum(['api', 'worker', 'all']),
  version: z.string(),
  gitSha: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export * from './text-normalization.js';
export * from './jobs.js';
export * from './modality.js';
export * from './documents.js';
export * from './visuals.js';
export * from './evidence.js';
export * from './verifiers/index.js';
