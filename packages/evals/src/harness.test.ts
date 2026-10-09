import { describe, it, expect } from 'vitest';
import {
  EvaluationHarness,
  FACT_PRECISION_THRESHOLD,
  GROUNDING_PASS_RATE_THRESHOLD,
  type EvaluationSample,
} from './harness.js';

describe('Evaluation Harness Skeleton (Phase 2)', () => {
  it('enforces PRD quality threshold constants', () => {
    expect(FACT_PRECISION_THRESHOLD).toBe(0.99);
    expect(GROUNDING_PASS_RATE_THRESHOLD).toBe(1.0);
  });

  it('registers and filters gold-set samples by modality', () => {
    const harness = new EvaluationHarness();

    const samplePdf: EvaluationSample = {
      id: 'gold-pdf-01',
      modality: 'text_pdf',
      documentType: 'budget',
      name: 'NDMC Budget 2026-27 Excerpt',
      expectedFacts: [
        {
          label: 'Revenue Receipts',
          value: 5211.92,
          quote: 'BE 2026-27 for revenue receipts are ₹5,211.92 Crore',
        },
      ],
      expectedInsightSentences: [
        'Revenue receipts are budgeted at 5211.92 crore for fiscal year 2026-27.',
      ],
    };

    const sampleCsv: EvaluationSample = {
      id: 'gold-csv-01',
      modality: 'table',
      documentType: 'dataset',
      name: 'Ward Capital Outlay Tabular CSV',
      expectedFacts: [
        {
          label: 'Total Capital Outlay',
          value: 741.15,
          quote: '741.15',
        },
      ],
    };

    harness.registerGoldSample(samplePdf);
    harness.registerGoldSample(sampleCsv);

    const pdfSamples = harness.getSamplesForModality('text_pdf');
    expect(pdfSamples).toHaveLength(1);
    expect(pdfSamples[0]?.id).toBe('gold-pdf-01');

    const csvSamples = harness.getSamplesForModality('table');
    expect(csvSamples).toHaveLength(1);
    expect(csvSamples[0]?.id).toBe('gold-csv-01');

    const geoSamples = harness.getSamplesForModality('geo_data');
    expect(geoSamples).toHaveLength(0);
  });

  it('scores perfect precision and grounding correctly', () => {
    const harness = new EvaluationHarness();

    const sample: EvaluationSample = {
      id: 'gold-eval-01',
      modality: 'text_pdf',
      documentType: 'budget',
      name: 'Test Budget Excerpt',
      expectedFacts: [
        { label: 'Fact A', value: 100, quote: 'Fact A is 100' },
        { label: 'Fact B', value: 200, quote: 'Fact B is 200' },
      ],
      expectedInsightSentences: ['Fact A and Fact B show growth.'],
    };

    harness.registerGoldSample(sample);

    const result = harness.evaluateExtraction('gold-eval-01', {
      extractedFacts: [
        { label: 'Fact A', value: 100, quote: 'Fact A is 100', isVerified: true },
        { label: 'Fact B', value: 200, quote: 'Fact B is 200', isVerified: true },
      ],
      insightSentences: [{ text: 'Fact A and Fact B show growth.', isGrounded: true }],
    });

    expect(result.precision).toBe(1.0);
    expect(result.recall).toBe(1.0);
    expect(result.groundingRate).toBe(1.0);
    expect(result.passed).toBe(true);
  });

  it('detects sub-threshold precision when hallucinated or unverified facts are returned', () => {
    const harness = new EvaluationHarness();

    const sample: EvaluationSample = {
      id: 'gold-eval-02',
      modality: 'text_pdf',
      documentType: 'budget',
      name: 'Test Budget Hallucination Detection',
      expectedFacts: [{ label: 'Fact A', value: 100, quote: 'Fact A is 100' }],
    };

    harness.registerGoldSample(sample);

    const result = harness.evaluateExtraction('gold-eval-02', {
      extractedFacts: [
        { label: 'Fact A', value: 100, quote: 'Fact A is 100', isVerified: true },
        // Unverified / invented fact
        { label: 'Invented Fact C', value: 999, quote: 'Nonexistent quote', isVerified: false },
      ],
    });

    // 1 verified out of 2 proposed = 0.5 precision (< 0.99 threshold)
    expect(result.precision).toBe(0.5);
    expect(result.passed).toBe(false);
  });

  it('executes a modality sweep runner and computes aggregate summary', async () => {
    const harness = new EvaluationHarness();

    harness.registerGoldSample({
      id: 'sweep-01',
      modality: 'table',
      documentType: 'dataset',
      name: 'Dataset 1',
      expectedFacts: [{ label: 'Row 1', value: 42, quote: '42' }],
    });

    harness.registerGoldSample({
      id: 'sweep-02',
      modality: 'table',
      documentType: 'dataset',
      name: 'Dataset 2',
      expectedFacts: [{ label: 'Row 2', value: 84, quote: '84' }],
    });

    const summary = await harness.runModalitySweep('table', async (sample) => {
      return {
        extractedFacts: sample.expectedFacts.map((f) => ({ ...f, isVerified: true })),
      };
    });

    expect(summary.sampleCount).toBe(2);
    expect(summary.passedCount).toBe(2);
    expect(summary.averagePrecision).toBe(1.0);
    expect(summary.meetsThresholds).toBe(true);
  });
});
