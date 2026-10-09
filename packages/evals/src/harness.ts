import type { Modality, DocumentType } from '@juris/shared';

/**
 * PRD Section 10 authoritative quality thresholds:
 * - Fact Precision: >= 99% of displayed facts verified
 * - Grounding Pass Rate: 100% of displayed insight sentences grounded
 * - OCR Match Rate: >= 95%
 */
export const FACT_PRECISION_THRESHOLD = 0.99;
export const GROUNDING_PASS_RATE_THRESHOLD = 1.0;
export const OCR_MATCH_THRESHOLD = 0.95;

export interface ExpectedFact {
  label: string;
  value: number | string;
  quote: string;
}

export interface EvaluationSample {
  id: string;
  modality: Modality;
  documentType?: DocumentType;
  name: string;
  expectedFacts: ExpectedFact[];
  expectedInsightSentences?: string[];
  metadata?: Record<string, unknown>;
}

export interface CandidateFact {
  label: string;
  value: number | string;
  quote: string;
  isVerified?: boolean;
}

export interface CandidateSentence {
  text: string;
  isGrounded?: boolean;
}

export interface ExtractionEvaluationInput {
  extractedFacts: CandidateFact[];
  insightSentences?: CandidateSentence[];
}

export interface EvaluationMetric {
  sampleId: string;
  precision: number;
  recall: number;
  f1: number;
  groundingRate: number;
  passed: boolean;
}

export interface ModalityEvalSummary {
  modality: Modality;
  sampleCount: number;
  passedCount: number;
  averagePrecision: number;
  groundingPassRate: number;
  meetsThresholds: boolean;
}

export class EvaluationHarness {
  private samples: Map<string, EvaluationSample> = new Map();

  /**
   * Registers a curated golden sample into the evaluation catalog.
   */
  public registerGoldSample(sample: EvaluationSample): void {
    this.samples.set(sample.id, sample);
  }

  /**
   * Returns all registered golden samples matching a given modality.
   */
  public getSamplesForModality(modality: Modality): EvaluationSample[] {
    return Array.from(this.samples.values()).filter((s) => s.modality === modality);
  }

  /**
   * Evaluates the extracted facts and insight sentences of a sample against its gold truth.
   */
  public evaluateExtraction(sampleId: string, output: ExtractionEvaluationInput): EvaluationMetric {
    const sample = this.samples.get(sampleId);
    if (!sample) {
      throw new Error(`Sample not found in harness: ${sampleId}`);
    }

    const totalExtracted = output.extractedFacts.length;
    const verifiedExtracted = output.extractedFacts.filter((f) => f.isVerified === true).length;

    // Precision = verified extracted facts / total extracted facts
    const precision = totalExtracted > 0 ? verifiedExtracted / totalExtracted : 1.0;

    // Recall = matching expected facts / total expected facts
    let matchCount = 0;
    for (const expected of sample.expectedFacts) {
      const match = output.extractedFacts.find(
        (cand) =>
          cand.label.toLowerCase() === expected.label.toLowerCase() && cand.isVerified === true,
      );
      if (match) matchCount++;
    }

    const totalExpected = sample.expectedFacts.length;
    const recall = totalExpected > 0 ? matchCount / totalExpected : 1.0;

    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0.0;

    // Grounding Pass Rate = grounded sentences / total insight sentences
    const totalSentences = output.insightSentences ? output.insightSentences.length : 0;
    const groundedSentences = output.insightSentences
      ? output.insightSentences.filter((s) => s.isGrounded === true).length
      : 0;

    const groundingRate = totalSentences > 0 ? groundedSentences / totalSentences : 1.0;

    const passed =
      precision >= FACT_PRECISION_THRESHOLD && groundingRate >= GROUNDING_PASS_RATE_THRESHOLD;

    return {
      sampleId,
      precision,
      recall,
      f1,
      groundingRate,
      passed,
    };
  }

  /**
   * Executes an evaluation sweep for all samples in a modality.
   */
  public async runModalitySweep(
    modality: Modality,
    runner: (sample: EvaluationSample) => Promise<ExtractionEvaluationInput>,
  ): Promise<ModalityEvalSummary> {
    const samples = this.getSamplesForModality(modality);
    if (samples.length === 0) {
      return {
        modality,
        sampleCount: 0,
        passedCount: 0,
        averagePrecision: 1.0,
        groundingPassRate: 1.0,
        meetsThresholds: true,
      };
    }

    let passedCount = 0;
    let sumPrecision = 0;
    let sumGrounding = 0;

    for (const sample of samples) {
      const output = await runner(sample);
      const metric = this.evaluateExtraction(sample.id, output);

      if (metric.passed) passedCount++;
      sumPrecision += metric.precision;
      sumGrounding += metric.groundingRate;
    }

    const averagePrecision = sumPrecision / samples.length;
    const groundingPassRate = sumGrounding / samples.length;
    const meetsThresholds =
      averagePrecision >= FACT_PRECISION_THRESHOLD &&
      groundingPassRate >= GROUNDING_PASS_RATE_THRESHOLD &&
      passedCount === samples.length;

    return {
      modality,
      sampleCount: samples.length,
      passedCount,
      averagePrecision,
      groundingPassRate,
      meetsThresholds,
    };
  }
}
