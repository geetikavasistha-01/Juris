import { describe, it, expect } from 'vitest';
import {
  ModalFactSchema,
  BBoxSchema,
  QueryPlanSchema,
  neutralizeFormula,
  isChartEligible,
  FILE_KIND_RULES,
} from './modality.js';

describe('modality contracts', () => {
  it('validates a verified quote_on_page modal fact', () => {
    const valid = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      documentId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      modality: 'text_pdf',
      type: 'budget_revenue',
      value: 5211.92,
      unit: 'crore',
      currency: 'INR',
      period: '2026-27',
      locator: {
        kind: 'page_quote',
        page: 33,
        quote: 'The BE 2026-27 for the revenue receipts are Rs.5211.92 Crore',
      },
      verified: true,
      verificationMethod: 'quote_on_page',
      ocrAgreement: null,
      failReason: null,
    };

    const parsed = ModalFactSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(isChartEligible(parsed.data)).toBe(true);
    }
  });

  it('rejects unverified fact without failReason', () => {
    const invalid = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      documentId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      modality: 'text_pdf',
      type: 'budget_revenue',
      value: 5211.92,
      unit: 'crore',
      currency: 'INR',
      period: '2026-27',
      locator: {
        kind: 'page_quote',
        page: 33,
        quote: 'Unverifiable text',
      },
      verified: false,
      verificationMethod: 'unverified',
      ocrAgreement: null,
      failReason: null, // invalid: required when unverified
    };

    const parsed = ModalFactSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('validates BBox within 0..1 bounds', () => {
    expect(BBoxSchema.safeParse({ x: 0.1, y: 0.2, width: 0.5, height: 0.4 }).success).toBe(true);
    expect(BBoxSchema.safeParse({ x: 0.8, y: 0.2, width: 0.5, height: 0.4 }).success).toBe(false); // exceeds 1.0
  });

  it('validates query plan structure', () => {
    const plan = {
      version: 1,
      filters: [{ column: 'department', op: 'eq', value: 'Health' }],
      groupBy: ['sector'],
      aggregates: [{ fn: 'sum', column: 'amount', alias: 'total_amount' }],
      orderBy: [{ key: 'total_amount', direction: 'desc' }],
      limit: 10,
    };
    expect(QueryPlanSchema.safeParse(plan).success).toBe(true);
  });

  it('neutralizes spreadsheet formula injection', () => {
    expect(neutralizeFormula('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(neutralizeFormula('+12345')).toBe("'+12345");
    expect(neutralizeFormula('-cmd|')).toBe("'-cmd|");
    expect(neutralizeFormula('@SUM')).toBe("'@SUM");
    expect(neutralizeFormula('Standard Text')).toBe('Standard Text');
  });

  it('rejects disallowed file kinds like SVG and HTML', () => {
    expect('svg' in FILE_KIND_RULES).toBe(false);
    expect('html' in FILE_KIND_RULES).toBe(false);
    expect('exe' in FILE_KIND_RULES).toBe(false);
  });
});
