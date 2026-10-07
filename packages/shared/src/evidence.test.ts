import { describe, it, expect } from 'vitest';
import {
  ProofTypeSchema,
  SpanKindSchema,
  EvidenceSpanSchema,
  EntitySchema,
  RelationSchema,
  DerivedFactSchema,
  ReconciliationSchema,
  FlagSchema,
  isOverviewEligibleProofType,
  verifyTextSpanFact,
} from './index.js';

describe('Evidence Graph Contracts & Proof Types (v2 PRD Section 3)', () => {
  it('validates all 9 proof types', () => {
    const validProofTypes = [
      'VERIFIED',
      'VERIFIED_OCR',
      'COMPUTED',
      'DERIVED',
      'USER_CONFIRMED',
      'ESTIMATED',
      'CONFLICT',
      'UNVERIFIABLE',
      'REJECTED',
    ];

    for (const pt of validProofTypes) {
      expect(ProofTypeSchema.parse(pt)).toBe(pt);
    }

    expect(() => ProofTypeSchema.parse('MOCK_STATUS')).toThrow();
  });

  it('correctly gates overview visual eligibility by proof type and estimate toggle', () => {
    expect(isOverviewEligibleProofType('VERIFIED')).toBe(true);
    expect(isOverviewEligibleProofType('VERIFIED_OCR')).toBe(true);
    expect(isOverviewEligibleProofType('COMPUTED')).toBe(true);
    expect(isOverviewEligibleProofType('DERIVED')).toBe(true);

    // Estimates & user-confirmed are excluded by default, enabled only when includeEstimates = true
    expect(isOverviewEligibleProofType('ESTIMATED', false)).toBe(false);
    expect(isOverviewEligibleProofType('ESTIMATED', true)).toBe(true);
    expect(isOverviewEligibleProofType('USER_CONFIRMED', false)).toBe(false);
    expect(isOverviewEligibleProofType('USER_CONFIRMED', true)).toBe(true);

    // Conflicts and rejections are never eligible
    expect(isOverviewEligibleProofType('CONFLICT', true)).toBe(false);
    expect(isOverviewEligibleProofType('REJECTED', true)).toBe(false);
    expect(isOverviewEligibleProofType('UNVERIFIABLE', true)).toBe(false);
  });

  it('validates all 5 evidence span locators', () => {
    const validSpanKinds = ['text_span', 'table_cell', 'image_region', 'csv_range', 'geo_feature'];

    for (const sk of validSpanKinds) {
      expect(SpanKindSchema.parse(sk)).toBe(sk);
    }

    const textSpan = EvidenceSpanSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      sourceId: '550e8400-e29b-41d4-a716-446655440001',
      documentId: '550e8400-e29b-41d4-a716-446655440002',
      kind: 'text_span',
      locator: {
        pageNumber: 3,
        bbox: [100, 200, 300, 250],
        charRange: [120, 185],
      },
      text: 'Total education allocation stands at Rs 5,420 crore.',
    });

    expect(textSpan.kind).toBe('text_span');
  });

  it('validates Entity, Relation, and DerivedFact models', () => {
    const ministryEntity = EntitySchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440010',
      documentId: '550e8400-e29b-41d4-a716-446655440011',
      kind: 'ministry',
      name: 'Ministry of Road Transport',
      aliases: ['MoRTH', 'Road Transport'],
    });

    const schemeEntity = EntitySchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440012',
      documentId: '550e8400-e29b-41d4-a716-446655440011',
      kind: 'scheme',
      name: 'National Highways Development',
      aliases: ['NHDP'],
    });

    const relation = RelationSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440020',
      documentId: '550e8400-e29b-41d4-a716-446655440011',
      subjectId: ministryEntity.id,
      predicate: 'funds',
      objectId: schemeEntity.id,
      factIds: ['550e8400-e29b-41d4-a716-446655440030'],
    });

    expect(relation.predicate).toBe('funds');

    const derivedFact = DerivedFactSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440040',
      documentId: '550e8400-e29b-41d4-a716-446655440011',
      formula: '(factA - factB) / factB * 100',
      sourceFactIds: [
        '550e8400-e29b-41d4-a716-446655440030',
        '550e8400-e29b-41d4-a716-446655440031',
      ],
      label: 'YoY Growth Rate',
      value: 14.8,
      unit: '%',
    });

    expect(derivedFact.proofType).toBe('DERIVED');
  });

  it('validates Reconciliations and Flag rules', () => {
    const rec = ReconciliationSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440050',
      documentId: '550e8400-e29b-41d4-a716-446655440011',
      kind: 'sum_of_parts',
      status: 'reconciled',
      sourceFactIds: [
        '550e8400-e29b-41d4-a716-446655440030',
        '550e8400-e29b-41d4-a716-446655440031',
      ],
      statedTotal: 1000,
      computedTotal: 1000,
      delta: 0,
      detail:
        'Capital and Revenue expenditures sum precisely to total budget outlay of Rs 1,000 crore.',
    });

    expect(rec.status).toBe('reconciled');

    const flag = FlagSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440060',
      documentId: '550e8400-e29b-41d4-a716-446655440011',
      rule: 'ALLOCATION_DROP_SIGNIFICANT',
      severity: 'warning',
      sourceFactIds: ['550e8400-e29b-41d4-a716-446655440030'],
      text: 'Public health allocation fell by 18.4% compared to FY 2024-25 RE.',
    });

    expect(flag.rule).toBe('ALLOCATION_DROP_SIGNIFICANT');
  });

  it('runs mechanical text verification via verifyTextSpanFact', () => {
    const pageText = `
      GOVERNMENT OF INDIA
      BUDGET SPEECH 2025-2026
      
      For the fiscal year 2025-26, I propose a capital allocation of Rs. 11,11,111 crore for infrastructure development,
      which represents 3.4% of GDP.
    `;

    const validFact = {
      quote: 'I propose a capital allocation of Rs. 11,11,111 crore for infrastructure development',
      value: 1111111,
      unit: 'crore',
      period: '2025-26',
      type: 'allocation',
    };

    const result = verifyTextSpanFact(pageText, validFact);
    expect(result.verified).toBe(true);
    expect(result.proofType).toBe('VERIFIED');
    expect(result.failReason).toBeNull();
    expect(result.exactMatch).toBe(true);

    const tamperedFact = {
      ...validFact,
      value: 9999999, // Altered number
    };
    const failedResult = verifyTextSpanFact(pageText, tamperedFact);
    expect(failedResult.verified).toBe(false);
    expect(failedResult.proofType).toBe('REJECTED');
    expect(failedResult.failReason).toBe('VALUE_NOT_IN_QUOTE');
  });
});
