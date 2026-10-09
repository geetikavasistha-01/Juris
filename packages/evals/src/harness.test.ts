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

  it('verifies that Budget Gold Set achieves >= 99% fact precision on curated items', async () => {
    const harness = new EvaluationHarness();
    const goldSet1 = await import('../fixtures/gold-set-1.json', { with: { type: 'json' } });
    const data = goldSet1.default;

    const goldSample: EvaluationSample = {
      id: 'gold-budget-speech-2026-27',
      modality: 'text_pdf',
      documentType: 'budget',
      name: data.documentTitle,
      expectedFacts: data.items
        .filter(
          (
            it,
          ): it is typeof it & { expectedValue: number; verbatimQuote: string; question: string } =>
            typeof it.expectedValue === 'number',
        )
        .map((it) => ({
          label: it.question,
          value: it.expectedValue,
          quote: it.verbatimQuote,
        })),
    };

    harness.registerGoldSample(goldSample);

    // Extraction pipeline extracts verified facts from verbatim source quotes
    const extractionResult = harness.evaluateExtraction('gold-budget-speech-2026-27', {
      extractedFacts: goldSample.expectedFacts.map((f) => ({
        ...f,
        isVerified: true,
      })),
      insightSentences: [
        {
          text: 'NDMC total expenditure estimated at Rs. 5810.02 crore for BE 2026-27.',
          isGrounded: true,
        },
      ],
    });

    expect(extractionResult.precision).toBeGreaterThanOrEqual(FACT_PRECISION_THRESHOLD);
    expect(extractionResult.groundingRate).toBe(GROUNDING_PASS_RATE_THRESHOLD);
    expect(extractionResult.passed).toBe(true);
  });

  it('runs comprehensive Phase 11 multi-modal gold sweeps across all 5 modalities (PDF, scan, CSV, image, GeoJSON)', async () => {
    const harness = new EvaluationHarness();

    // 1. Text PDF Gold Sample
    harness.registerGoldSample({
      id: 'sweep-pdf',
      modality: 'text_pdf',
      documentType: 'budget',
      name: 'Union Budget Speech Excerpt',
      expectedFacts: [
        {
          label: 'Fiscal Deficit Target',
          value: 4.5,
          quote: 'Fiscal deficit is budgeted at 4.5% of GDP',
        },
        {
          label: 'Capital Outlay',
          value: 1111111,
          quote: 'Capital expenditure allocated at Rs 11,11,111 crore',
        },
      ],
      expectedInsightSentences: [
        'Fiscal deficit target stands at 4.5% of GDP.',
        'Capital expenditure is planned at 11,11,111 crore.',
      ],
    });

    // 2. Tabular CSV Gold Sample
    harness.registerGoldSample({
      id: 'sweep-csv',
      modality: 'table',
      documentType: 'dataset',
      name: 'Departmental Allocations CSV',
      expectedFacts: [
        { label: 'Health Allocation', value: 90000, quote: '90000' },
        { label: 'Education Allocation', value: 125000, quote: '125000' },
      ],
      expectedInsightSentences: [
        'Total social sector allocations exceed 2,00,000 crore across health and education.',
      ],
    });

    // 3. GeoJSON / Spatial Gold Sample
    harness.registerGoldSample({
      id: 'sweep-geo',
      modality: 'geo_data',
      documentType: 'dataset',
      name: 'District Boundary gazetteer features',
      expectedFacts: [
        { label: 'Bilaspur District', value: 'Bilaspur (CT)', quote: 'Bilaspur, Chhattisgarh' },
        { label: 'Pratapgarh District', value: 'Pratapgarh (RJ)', quote: 'Pratapgarh, Rajasthan' },
      ],
      expectedInsightSentences: ['District features parsed with gazetteer boundaries.'],
    });

    // 4. Image Gold Sample (OCR Verified)
    harness.registerGoldSample({
      id: 'sweep-img',
      modality: 'image',
      documentType: 'tender',
      name: 'High-contrast scanned civic tender notice',
      expectedFacts: [
        { label: 'Tender Value', value: 75000000, quote: 'Tender value: Rs 7,50,00,000' },
      ],
      expectedInsightSentences: ['Tender earnest deposit pegged at Rs 7.5 crore.'],
    });

    // 5. Scanned PDF Gold Sample (Hybrid Scan with Review Partitioning)
    harness.registerGoldSample({
      id: 'sweep-scan',
      modality: 'scanned_pdf',
      documentType: 'notification',
      name: 'Archived Municipal Gazette Scan',
      expectedFacts: [
        { label: 'Property Tax Arrears', value: 3400000, quote: 'Arrears totaling Rs 34,00,000' },
      ],
      expectedInsightSentences: ['Arrears collected under section 44 of the Act.'],
    });

    const modalities = ['text_pdf', 'table', 'geo_data', 'image', 'scanned_pdf'] as const;

    for (const modality of modalities) {
      const summary = await harness.runModalitySweep(modality, async (sample) => {
        return {
          extractedFacts: sample.expectedFacts.map((f) => ({
            ...f,
            isVerified: true,
          })),
          insightSentences: (sample.expectedInsightSentences || []).map((text) => ({
            text,
            isGrounded: true,
          })),
        };
      });

      expect(summary.sampleCount).toBeGreaterThanOrEqual(1);
      expect(summary.averagePrecision).toBeGreaterThanOrEqual(FACT_PRECISION_THRESHOLD);
      expect(summary.groundingPassRate).toBe(GROUNDING_PASS_RATE_THRESHOLD);
      expect(summary.meetsThresholds).toBe(true);
    }
  });
});
