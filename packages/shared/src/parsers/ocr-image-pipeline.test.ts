import { describe, it, expect } from 'vitest';
import {
  preprocessImage,
  evaluateOcrConfidence,
  processVisionFactCandidate,
  processScannedPageFacts,
  OCR_CONFIDENCE_FLOOR,
  type OcrToken,
  type VisionFactExtractionCandidate,
} from './ocr-image-pipeline.js';

describe('Images & Scanned PDFs Modality Pipeline (Phase 9)', () => {
  describe('Image Preprocessing & Security Limits', () => {
    it('validates and recognizes PNG magic bytes', () => {
      const pngHeader = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
      ]);
      const res = preprocessImage(pngHeader, { width: 1920, height: 1080 });
      expect(res.isSafe).toBe(true);
      expect(res.mimeType).toBe('image/png');
      expect(res.width).toBe(1920);
      expect(res.height).toBe(1080);
    });

    it('identifies and strips EXIF metadata in JPEG images for privacy', () => {
      // JPEG with APP1 (0xFF, 0xE1) marker
      const jpegWithExif = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe1, 0x00, 0x20, 0x45, 0x78, 0x69, 0x66,
      ]);
      const res = preprocessImage(jpegWithExif, { width: 800, height: 600 }, { stripExif: true });
      expect(res.mimeType).toBe('image/jpeg');
      expect(res.strippedExif).toBe(true);
    });

    it('rejects unsupported image formats', () => {
      const invalid = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(() => preprocessImage(invalid)).toThrowError('UNSUPPORTED_FORMAT');
    });

    it('rejects image dimensions exceeding 8000px limit', () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(() => preprocessImage(png, { width: 8500, height: 2000 })).toThrowError(
        'IMAGE_DIMENSIONS_EXCEEDED',
      );
    });
  });

  describe('OCR Confidence Floor Verification', () => {
    const tokens: OcrToken[] = [
      { text: 'Total', confidence: 95, bbox: [0.1, 0.1, 0.2, 0.15], pageNumber: 1 },
      { text: 'Expenditure', confidence: 92, bbox: [0.21, 0.1, 0.45, 0.15], pageNumber: 1 },
      { text: '5420.50', confidence: 96, bbox: [0.46, 0.1, 0.6, 0.15], pageNumber: 1 },
      { text: 'Crore', confidence: 90, bbox: [0.61, 0.1, 0.75, 0.15], pageNumber: 1 },
      // Low confidence token
      { text: 'Contingency', confidence: 55, bbox: [0.1, 0.3, 0.3, 0.35], pageNumber: 1 },
      { text: 'Reserve', confidence: 48, bbox: [0.31, 0.3, 0.5, 0.35], pageNumber: 1 },
    ];

    it('accurately evaluates OCR token confidence above floor (>= 80%)', () => {
      const res = evaluateOcrConfidence(tokens, 'Total Expenditure 5420.50 Crore');
      expect(res.passedFloor).toBe(true);
      expect(res.confidence).toBeGreaterThanOrEqual(OCR_CONFIDENCE_FLOOR);
      expect(res.matchedTokens.length).toBeGreaterThan(0);
    });

    it('GATE: low-quality OCR tokens below floor (< 80%) fail threshold', () => {
      const res = evaluateOcrConfidence(tokens, 'Contingency Reserve');
      expect(res.passedFloor).toBe(false);
      expect(res.confidence).toBeLessThan(OCR_CONFIDENCE_FLOOR);
    });
  });

  describe('Candidate Fact Processing & Review Queue Routing', () => {
    const ocrTokens: OcrToken[] = [
      { text: 'Health', confidence: 94, bbox: [0.1, 0.2, 0.25, 0.25] },
      { text: 'Allocation', confidence: 90, bbox: [0.26, 0.2, 0.45, 0.25] },
      { text: '1250', confidence: 92, bbox: [0.46, 0.2, 0.55, 0.25] },
      { text: 'Deficit', confidence: 58, bbox: [0.1, 0.5, 0.25, 0.55] },
      { text: '320', confidence: 60, bbox: [0.26, 0.5, 0.35, 0.55] },
    ];

    it('marks high-confidence fact as VERIFIED_OCR without review routing', () => {
      const candidate: VisionFactExtractionCandidate = {
        label: 'Health Allocation',
        rawText: 'Health Allocation 1250',
        value: 1250,
        unit: 'crore',
        currency: 'INR',
        period: { basis: 'BE', fiscalYear: '2025-26' },
        bbox: [0.1, 0.2, 0.55, 0.25],
        page: 1,
      };

      const result = processVisionFactCandidate(candidate, ocrTokens);
      expect(result.fact.verified).toBe(true);
      expect(result.fact.proofType).toBe('VERIFIED_OCR');
      expect(result.fact.routesToReviewQueue).toBe(false);
      expect(result.fact.dashedStyling).toBe(false);
      expect(result.reviewItem).toBeUndefined();
    });

    it('GATE: low-confidence scanned text produces ESTIMATED fact routed to review_queue', () => {
      const lowQualityCandidate: VisionFactExtractionCandidate = {
        label: 'Fiscal Deficit',
        rawText: 'Deficit 320',
        value: 320,
        unit: 'crore',
        currency: 'INR',
        period: { basis: 'RE', fiscalYear: '2024-25' },
        bbox: [0.1, 0.5, 0.35, 0.55],
        page: 1,
      };

      const result = processVisionFactCandidate(lowQualityCandidate, ocrTokens);
      expect(result.fact.verified).toBe(false);
      expect(result.fact.proofType).toBe('ESTIMATED');
      expect(result.fact.routesToReviewQueue).toBe(true);
      expect(result.fact.dashedStyling).toBe(true);
      expect(result.reviewItem).toBeDefined();
      expect(result.reviewItem?.status).toBe('pending');
      expect(result.reviewItem?.ocrConfidence).toBeLessThan(80);
      expect(result.reviewItem?.suggestedProofType).toBe('USER_CONFIRMED');
    });

    it('GATE: marks chart values as ESTIMATED with dashed styling when labels are unverified', () => {
      const chartCandidate: VisionFactExtractionCandidate = {
        label: 'Capital Outlay Bar Estimate',
        rawText: 'Bar segment height at ~480',
        value: 480,
        unit: 'crore',
        currency: 'INR',
        period: null,
        bbox: [0.4, 0.6, 0.7, 0.9],
        page: 2,
        isChartElement: true,
        hasVerifiedLabel: false, // Estimated visually from chart!
      };

      const result = processVisionFactCandidate(chartCandidate, ocrTokens);
      expect(result.fact.proofType).toBe('ESTIMATED');
      expect(result.fact.verified).toBe(false);
      expect(result.fact.dashedStyling).toBe(true);
      expect(result.fact.routesToReviewQueue).toBe(true);
      expect(result.reviewItem).toBeDefined();
      expect(result.reviewItem?.reason).toContain('visually estimated');
    });
  });

  describe('Batch Scanned Budget Page Gold Set (Gate Verification)', () => {
    it('processes full scanned budget page and partitions verified vs review items', () => {
      const ocrTokens: OcrToken[] = [
        { text: 'Revenue', confidence: 95, bbox: [0.1, 0.1, 0.2, 0.15] },
        { text: 'Receipts', confidence: 93, bbox: [0.21, 0.1, 0.35, 0.15] },
        { text: '8500', confidence: 98, bbox: [0.36, 0.1, 0.45, 0.15] },
        { text: 'Capital', confidence: 91, bbox: [0.1, 0.2, 0.2, 0.25] },
        { text: 'Expenditure', confidence: 94, bbox: [0.21, 0.2, 0.35, 0.25] },
        { text: '4200', confidence: 92, bbox: [0.36, 0.2, 0.45, 0.25] },
        // Smudged / stained line
        { text: 'Interest', confidence: 45, bbox: [0.1, 0.4, 0.2, 0.45] },
        { text: 'Payments', confidence: 52, bbox: [0.21, 0.4, 0.35, 0.45] },
      ];

      const candidates: VisionFactExtractionCandidate[] = [
        {
          label: 'Revenue Receipts',
          rawText: 'Revenue Receipts 8500',
          value: 8500,
          unit: 'crore',
          currency: 'INR',
          period: { basis: 'BE', fiscalYear: '2025-26' },
          bbox: [0.1, 0.1, 0.45, 0.15],
          page: 1,
        },
        {
          label: 'Capital Expenditure',
          rawText: 'Capital Expenditure 4200',
          value: 4200,
          unit: 'crore',
          currency: 'INR',
          period: { basis: 'BE', fiscalYear: '2025-26' },
          bbox: [0.1, 0.2, 0.45, 0.25],
          page: 1,
        },
        {
          label: 'Interest Payments (Smudged)',
          rawText: 'Interest Payments ~1100',
          value: 1100,
          unit: 'crore',
          currency: 'INR',
          period: { basis: 'BE', fiscalYear: '2025-26' },
          bbox: [0.1, 0.4, 0.35, 0.45],
          page: 1,
        },
      ];

      const pageResult = processScannedPageFacts(candidates, ocrTokens, 'budget_scan_page_1');

      expect(pageResult.allFacts.length).toBe(3);
      expect(pageResult.verifiedFacts.length).toBe(2);
      expect(pageResult.reviewQueue.length).toBe(1);

      // Verify that verified facts are VERIFIED_OCR
      expect(pageResult.verifiedFacts[0]?.proofType).toBe('VERIFIED_OCR');
      expect(pageResult.verifiedFacts[1]?.proofType).toBe('VERIFIED_OCR');

      // Verify that smudged low-confidence fact is in the review queue
      expect(pageResult.reviewQueue[0]?.label).toBe('Interest Payments (Smudged)');
      expect(pageResult.reviewQueue[0]?.ocrConfidence).toBeLessThan(80);
      expect(pageResult.reviewQueue[0]?.status).toBe('pending');
    });
  });
});
