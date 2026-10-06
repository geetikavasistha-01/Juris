import { describe, expect, it } from 'vitest';
import {
  type JobEvent,
  mergeJobEvent,
  type ProcessingStage,
  type ProcessingStateSnapshot,
} from './jobs.js';

describe('jobs contract and monotonic event merging', () => {
  const initialSnapshot: ProcessingStateSnapshot = {
    documentId: '123e4567-e89b-12d3-a456-426614174000',
    status: 'queued',
    currentStage: 'validating',
    progress: 0,
    lastSequence: 0,
    events: [],
  };

  const createEvent = (seq: number, stage: ProcessingStage, progress: number): JobEvent => ({
    id: `123e4567-e89b-12d3-a456-42661417400${seq}`,
    documentId: '123e4567-e89b-12d3-a456-426614174000',
    jobId: '223e4567-e89b-12d3-a456-426614174000',
    stage,
    progress,
    sequence: seq,
    message: `Stage ${stage} reached`,
    createdAt: new Date().toISOString(),
  });

  it('merges higher sequence events in strict increasing order', () => {
    const e1 = createEvent(1, 'validating', 10);
    const s1 = mergeJobEvent(initialSnapshot, e1);
    expect(s1.lastSequence).toBe(1);
    expect(s1.currentStage).toBe('validating');
    expect(s1.progress).toBe(10);
    expect(s1.events).toHaveLength(1);

    const e2 = createEvent(2, 'extracting', 25);
    const s2 = mergeJobEvent(s1, e2);
    expect(s2.lastSequence).toBe(2);
    expect(s2.currentStage).toBe('extracting');
    expect(s2.progress).toBe(25);
    expect(s2.events).toHaveLength(2);
  });

  it('drops duplicate or stale events with sequence <= lastSequence (deduplication)', () => {
    const e1 = createEvent(1, 'validating', 10);
    const s1 = mergeJobEvent(initialSnapshot, e1);

    // Replay e1
    const s1Replay = mergeJobEvent(s1, e1);
    expect(s1Replay).toBe(s1);
    expect(s1Replay.events).toHaveLength(1);

    // Stale out-of-order event
    const e0 = createEvent(0, 'validating', 0);
    const sStale = mergeJobEvent(s1, e0);
    expect(sStale).toBe(s1);
  });

  it('updates status to done when receiving done stage', () => {
    const eDone = createEvent(10, 'done', 100);
    const sDone = mergeJobEvent(initialSnapshot, eDone);
    expect(sDone.status).toBe('done');
    expect(sDone.currentStage).toBe('done');
    expect(sDone.progress).toBe(100);
  });
});
