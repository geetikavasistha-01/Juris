import { describe, expect, it } from 'vitest';
import {
  DocumentDetailResponseSchema,
  DocumentSchema,
  DocumentUploadResponseSchema,
} from './documents.js';

describe('Document Contracts', () => {
  it('validates a valid document schema', () => {
    const doc = {
      id: '11111111-1111-1111-1111-111111111111',
      ownerId: '22222222-2222-2222-2222-222222222222',
      filename: 'budget-2026.pdf',
      storagePath: 'documents/22222222-2222-2222-2222-222222222222/budget.pdf',
      fileSizeBytes: 1048576,
      sha256: 'a'.repeat(64),
      mimeType: 'application/pdf',
      status: 'queued',
      pageCount: 114,
      isSample: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const parsed = DocumentSchema.safeParse(doc);
    expect(parsed.success).toBe(true);
  });

  it('validates upload response schema', () => {
    const res = {
      documentId: '11111111-1111-1111-1111-111111111111',
      jobId: '33333333-3333-3333-3333-333333333333',
      status: 'queued',
      filename: 'budget.pdf',
      fileSizeBytes: 2048,
      sha256: 'b'.repeat(64),
      pageCount: 10,
    };
    const parsed = DocumentUploadResponseSchema.safeParse(res);
    expect(parsed.success).toBe(true);
  });

  it('validates document detail with analysis and verified facts', () => {
    const detail = {
      id: '11111111-1111-1111-1111-111111111111',
      filename: 'budget.pdf',
      status: 'done',
      pageCount: 114,
      fileSizeBytes: 2048,
      sha256: 'c'.repeat(64),
      isSample: false,
      analysis: {
        summary: 'NDMC Budget Summary',
        documentType: 'budget',
        keyFindings: ['Finding 1'],
        risks: ['Risk 1'],
      },
      facts: [
        {
          id: '44444444-4444-4444-4444-444444444444',
          type: 'financial_total',
          value: 5211.92,
          unit: 'crore',
          currency: 'INR',
          period: '2026-27',
          page: 33,
          quote: 'BE 2026-27 for revenue receipts are Rs.5211.92 Crore',
          verified: true,
          verificationMethod: 'quote_on_page',
          failReason: null,
        },
      ],
      job: {
        id: '33333333-3333-3333-3333-333333333333',
        status: 'completed',
        stage: 'done',
        progress: 100,
      },
    };
    const parsed = DocumentDetailResponseSchema.safeParse(detail);
    expect(parsed.success).toBe(true);
  });
});
