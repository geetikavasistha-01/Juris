import { createClient } from '@supabase/supabase-js';
import type { ProcessingStage } from '../../packages/shared/src/jobs.js';

const STAGES: Array<{ stage: ProcessingStage; progress: number; delayMs: number }> = [
  { stage: 'validating', progress: 10, delayMs: 300 },
  { stage: 'extracting', progress: 20, delayMs: 350 },
  { stage: 'chunking', progress: 30, delayMs: 350 },
  { stage: 'embedding', progress: 40, delayMs: 400 },
  { stage: 'classification', progress: 50, delayMs: 400 }, // Renamed from 'typing'
  { stage: 'fact_extraction', progress: 60, delayMs: 400 },
  { stage: 'verification', progress: 70, delayMs: 400 },
  { stage: 'synthesis', progress: 80, delayMs: 400 },
  { stage: 'building_visuals', progress: 90, delayMs: 350 },
  { stage: 'done', progress: 100, delayMs: 300 },
];

export async function runWorkerPipeline(
  supabaseUrl: string,
  serviceKey: string,
  documentId: string,
  jobId: string,
  ownerId: string,
  afterStep?: (stage: ProcessingStage, sequence: number) => Promise<void>,
): Promise<void> {
  const supabase = createClient(supabaseUrl, serviceKey);

  console.info(`[Worker] Starting processing pipeline for document ${documentId}...`);

  let sequence = 0;
  for (const step of STAGES) {
    sequence++;
    await new Promise((resolve) => setTimeout(resolve, step.delayMs));

    console.info(
      `[Worker] Publishing stage: ${step.stage} (Seq: ${sequence}, Progress: ${step.progress}%)`,
    );

    // 1. Insert real job_event row (triggers Supabase Realtime broadcast)
    const { error: eventError } = await supabase.from('job_events').insert({
      job_id: jobId,
      document_id: documentId,
      owner_id: ownerId,
      stage: step.stage,
      progress: step.progress,
      sequence: sequence,
      message: `Completed stage: ${step.stage}`,
      details: { timestamp: new Date().toISOString() },
    });

    if (eventError) {
      console.error(`[Worker] Failed to insert job_event for stage ${step.stage}:`, eventError);
      throw eventError;
    }

    // 2. Update document state
    await supabase
      .from('documents')
      .update({
        stage: step.stage,
        progress: step.progress,
        status: step.stage === 'done' ? 'done' : 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (afterStep) {
      await afterStep(step.stage, sequence);
    }
  }

  console.info(`[Worker] Pipeline finished successfully for document ${documentId}.`);
}
