import { describe, it, expect } from 'vitest';
import type { DocumentFactDetail, VisualSpec } from './index.js';
import {
  extractNumbersFromText,
  numbersMatch,
  computeTokenOverlap,
  verifyInsightClaim,
  generateDeterministicInsights,
} from './index.js';

describe('Grounding Verifier & Insight Engine', () => {
  const mockFacts: DocumentFactDetail[] = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      label: 'Education Allocation',
      type: 'allocation',
      value: 45000000,
      unit: 'USD',
      currency: 'USD',
      period: null,
      page: 1,
      quote: 'Allocated 45000000 USD for public schools and education programs.',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      label: 'Healthcare Allocation',
      type: 'allocation',
      value: 30000000,
      unit: 'USD',
      currency: 'USD',
      period: null,
      page: 2,
      quote: 'Reserved 30000000 USD for municipal clinics and health centers.',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      label: 'Infrastructure Works',
      type: 'allocation',
      value: 25000000,
      unit: 'USD',
      currency: 'USD',
      period: null,
      page: 3,
      quote: 'Dedicated 25000000 USD for road resurfacing and infrastructure.',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
  ];

  const factsMap = new Map(mockFacts.map((f) => [f.id, f]));

  const mockSpec: VisualSpec = {
    id: 'spec-test-1',
    documentId: '00000000-0000-0000-0000-000000000001',
    kind: 'horizontal_ranked_bar',
    title: 'Departmental Allocations',
    encodings: { category: 'Budget', unit: 'USD' },
    series: [
      {
        label: 'Education Allocation',
        value: 45000000,
        factIds: ['00000000-0000-0000-0000-000000000001'],
        proofType: 'VERIFIED',
      },
      {
        label: 'Healthcare Allocation',
        value: 30000000,
        factIds: ['00000000-0000-0000-0000-000000000002'],
        proofType: 'VERIFIED',
      },
      {
        label: 'Infrastructure Works',
        value: 25000000,
        factIds: ['00000000-0000-0000-0000-000000000003'],
        proofType: 'VERIFIED',
      },
    ],
    proofSummary: {
      totalPoints: 3,
      verifiedCount: 3,
      overallProofType: 'VERIFIED',
    },
    a11yTable: {
      headers: ['Department', 'Allocation'],
      rows: [
        ['Education Allocation', 45000000],
        ['Healthcare Allocation', 30000000],
        ['Infrastructure Works', 25000000],
      ],
    },
    rank: 1,
  };

  it('extracts numbers accurately from complex text strings', () => {
    const text = 'Allocated $45,000,000.50 (which represents 45% of the total 100M budget)';
    const numbers = extractNumbersFromText(text);
    expect(numbers).toContain(45000000.5);
    expect(numbers).toContain(45);
    expect(numbers).toContain(100);
  });

  it('matches numbers within acceptable numerical tolerance', () => {
    expect(numbersMatch(45000000, 45000000)).toBe(true);
    expect(numbersMatch(45000000, 45000100, 0.01)).toBe(true);
    expect(numbersMatch(45000000, 50000000, 0.01)).toBe(false);
  });

  it('computes lexical token overlap against reference strings', () => {
    const overlap = computeTokenOverlap('Allocated 45M for schools and education', [
      'Allocated 45000000 USD for public schools and education programs.',
    ]);
    expect(overlap).toBeGreaterThan(0.4);
  });

  it('mechanically verifies a grounded claim with exact matching numbers', () => {
    const claim = verifyInsightClaim(
      {
        claimText: 'Education Allocation accounts for 45000000 USD in funding.',
        factIds: ['00000000-0000-0000-0000-000000000001'],
      },
      factsMap,
    );

    expect(claim.isVerified).toBe(true);
    expect(claim.proofType).toBe('VERIFIED');
    expect(claim.rejectionReason).toBeUndefined();
  });

  it('mechanically rejects an ungrounded hallucinated claim with fabricated numbers', () => {
    const claim = verifyInsightClaim(
      {
        claimText: 'Education Allocation received 99999999 USD in funding from the state.',
        factIds: ['00000000-0000-0000-0000-000000000001'],
      },
      factsMap,
    );

    expect(claim.isVerified).toBe(false);
    expect(claim.proofType).toBe('REJECTED');
    expect(claim.rejectionReason).toContain('Unverified number(s)');
  });

  it('generates 100% deterministic, citation-backed insights from VisualSpec', () => {
    const insight = generateDeterministicInsights(mockSpec, mockFacts);

    expect(insight.generatedBy).toBe('deterministic_template');
    expect(insight.claims.length).toBeGreaterThanOrEqual(2);
    expect(insight.claims.every((c) => c.isVerified)).toBe(true);
    expect(insight.summary).toContain('Education Allocation');
    expect(insight.summary).toContain('100,000,000 USD');
  });
});
