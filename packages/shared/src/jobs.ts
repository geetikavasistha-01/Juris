import { z } from 'zod';

/**
 * Closed pipeline processing stages.
 * Note: 'classification' (formerly 'typing' in PRD notes) explicitly denotes
 * document classification into schema categories (e.g. Budget, Policy, Audit, Legal).
 */
export const ProcessingStageSchema = z.enum([
  'validating',
  'extracting',
  'chunking',
  'embedding',
  'classification',
  'fact_extraction',
  'verification',
  'synthesis',
  'building_visuals',
  'done',
  'failed',
]);

export type ProcessingStage = z.infer<typeof ProcessingStageSchema>;
export const JobStageSchema = ProcessingStageSchema;
export type JobStage = ProcessingStage;

export const JobStatusSchema = z.enum(['queued', 'running', 'completed', 'failed']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const DocumentStatusSchema = z.enum(['uploaded', 'processing', 'processed', 'failed']);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

/**
 * Monotonic Job Event for real-time pub/sub via Supabase Realtime and polling recovery.
 * The monotonic 'sequence' counter guarantees deterministic deduplication and ordered delivery.
 */
export const JobEventSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  jobId: z.string().uuid(),
  stage: ProcessingStageSchema,
  progress: z.number().min(0).max(100),
  sequence: z.number().int().nonnegative(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().datetime(),
});

export type JobEvent = z.infer<typeof JobEventSchema>;

export interface ProcessingStateSnapshot {
  documentId: string;
  status: DocumentStatus;
  currentStage: ProcessingStage;
  progress: number;
  lastSequence: number;
  events: JobEvent[];
}

/**
 * Merges a newly received event into the client event stream.
 * Ignores duplicate or out-of-order events using the monotonic sequence number.
 */
export function mergeJobEvent(
  current: ProcessingStateSnapshot,
  newEvent: JobEvent,
): ProcessingStateSnapshot {
  // Deduplicate using monotonic sequence
  if (newEvent.sequence <= current.lastSequence) {
    return current;
  }

  const newStatus: DocumentStatus =
    newEvent.stage === 'done' ? 'done' : newEvent.stage === 'failed' ? 'failed' : 'processing';

  return {
    documentId: current.documentId,
    status: newStatus,
    currentStage: newEvent.stage,
    progress: newEvent.progress,
    lastSequence: newEvent.sequence,
    events: [...current.events, newEvent].sort((a, b) => a.sequence - b.sequence),
  };
}
