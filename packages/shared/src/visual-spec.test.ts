import { describe, it, expect } from 'vitest';
import {
  VisualSpecSchema,
  assertVisualSpecProvenance,
  selectVisualSpecs,
  type DocumentFactDetail,
} from './index.js';

describe('Declarative Visual Specs & Chart Selector (v2 PRD Section 6.1 & 6.2)', () => {
  const mockFacts: DocumentFactDetail[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      label: 'Capital Outlay on Transport',
      value: 12500,
      unit: 'crore',
      currency: 'INR',
      period: { fiscalYear: '2025-26', basis: 'BE' },
      page: 4,
      quote: 'Capital Outlay on Transport is estimated at Rs 12,500 crore in 2025-26.',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
      type: 'allocation',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      label: 'Capital Outlay on Education',
      value: 8200,
      unit: 'crore',
      currency: 'INR',
      period: { fiscalYear: '2025-26', basis: 'BE' },
      page: 6,
      quote: 'Capital Outlay on Education stands at Rs 8,200 crore.',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
      type: 'allocation',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      label: 'Capital Outlay on Health',
      value: 5400,
      unit: 'crore',
      currency: 'INR',
      period: { fiscalYear: '2025-26', basis: 'BE' },
      page: 8,
      quote: 'Health sector allocation is Rs 5,400 crore.',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
      type: 'allocation',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      label: 'Prior Year Transport Outlay',
      value: 10800,
      unit: 'crore',
      currency: 'INR',
      period: { fiscalYear: '2024-25', basis: 'RE' },
      page: 4,
      quote: 'Revised estimate for 2024-25 was Rs 10,800 crore.',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
      type: 'allocation',
    },
  ];

  it('validates VisualSpecSchema structure and enforces fact provenance', () => {
    const validSpec = {
      id: 'test-chart',
      kind: 'horizontal_ranked_bar',
      title: 'Top Allocations',
      encodings: { x: 'value', y: 'label', unit: 'crore' },
      series: [
        {
          label: 'Transport',
          value: 12500,
          factIds: ['550e8400-e29b-41d4-a716-446655440001'],
          proofType: 'VERIFIED',
        },
      ],
      proofSummary: {
        totalPoints: 1,
        verifiedCount: 1,
        overallProofType: 'VERIFIED',
      },
      a11yTable: {
        headers: ['Program', 'Value'],
        rows: [['Transport', 12500]],
      },
    };

    const parsed = VisualSpecSchema.parse(validSpec);
    expect(parsed.kind).toBe('horizontal_ranked_bar');
    expect(() => assertVisualSpecProvenance(parsed)).not.toThrow();

    const invalidSpec = {
      ...validSpec,
      series: [
        {
          label: 'Unproven Point',
          value: 9999,
          factIds: [], // Empty factIds!
          proofType: 'VERIFIED',
        },
      ],
    };

    expect(() => VisualSpecSchema.parse(invalidSpec)).toThrow();
  });

  it('deterministically selects ranked chart candidates based on verified facts', () => {
    const candidates = selectVisualSpecs(mockFacts);
    expect(candidates.length).toBeGreaterThanOrEqual(5);

    // Candidate 1: Key figures strip
    expect(candidates[0]!.kind).toBe('key_figures_strip');
    expect(candidates[0]!.series.length).toBeGreaterThan(0);

    // Candidate 2: Allocation breakdown (donut since 3 parts <= 6)
    expect(candidates[1]!.kind).toBe('donut_pie');

    // Candidate 3: Horizontal ranked bar
    expect(candidates[2]!.kind).toBe('horizontal_ranked_bar');

    // Candidate 4: Time series slope chart (2024-25 vs 2025-26)
    expect(candidates[3]!.kind).toBe('slope_chart');

    // Candidate 5: Grouped comparison bar
    expect(candidates[4]!.kind).toBe('grouped_stacked_bar');

    // Candidate 6: Bullet gauge
    expect(candidates[5]!.kind).toBe('bullet_gauge');

    // Confirm every point has provenance
    for (const spec of candidates) {
      assertVisualSpecProvenance(spec);
    }
  });

  it('rejects unverified or rejected facts from overview visuals', () => {
    const unverifiedFact: DocumentFactDetail = {
      id: '550e8400-e29b-41d4-a716-446655440099',
      label: 'Hallucinated Subsidies',
      value: 99999,
      unit: 'crore',
      currency: 'INR',
      period: null,
      page: 99,
      quote: 'Not in document',
      verified: false,
      verificationMethod: 'unverified',
      failReason: 'VALUE_NOT_IN_QUOTE',
      type: 'allocation',
    };

    const candidates = selectVisualSpecs([unverifiedFact]);
    expect(candidates.length).toBe(0);
  });
});
