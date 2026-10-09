import { describe, it, expect } from 'vitest';
import type { DocumentFactDetail } from './documents.js';
import { buildDocumentStoryboard } from './storyboard.js';

describe('Document Storyboard ("Document at a Glance") Engine', () => {
  const verifiedFacts: DocumentFactDetail[] = [
    {
      id: 'fact-1',
      label: 'Total Estimated Expenditure',
      type: 'financial_total',
      value: 5810.02,
      unit: 'crore',
      currency: 'INR',
      period: { basis: 'BE', fiscalYear: '2026-27' },
      page: 33,
      quote:
        'The total expenditure for BE 2026-27 are Rs.5810.02 Crore against Rs.5484.15 Crore provided in RE 2025-26',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: 'fact-2',
      label: 'Medical Services Allocation',
      type: 'allocation',
      value: 118.33,
      unit: 'crore',
      currency: 'INR',
      period: { basis: 'BE', fiscalYear: '2026-27' },
      page: 88,
      quote:
        'towards improvement of Medical Services Department out of which Rs.12.71 crore towards Capital and Rs.105.62 crore towards Revenue',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: 'fact-3',
      label: 'Digital Governance Initiative',
      type: 'definition',
      value: null,
      unit: null,
      currency: null,
      period: { basis: 'BE', fiscalYear: '2026-27' },
      page: 15,
      quote:
        'Single sign on is an authentication method letting users log in once across multiple municipal applications',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: 'fact-4',
      label: 'Cashless Transaction Policy',
      type: 'obligation',
      value: null,
      unit: null,
      currency: null,
      period: { basis: 'BE', fiscalYear: '2026-27' },
      page: 25,
      quote:
        'To eliminate Manual Transactions in the FY 2026-27, NDMC will phase out payments and receipts through cash',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: 'fact-5',
      label: 'Ward Infrastructure Development',
      type: 'allocation',
      value: 45.0,
      unit: 'crore',
      currency: 'INR',
      period: { basis: 'BE', fiscalYear: '2026-27' },
      page: 40,
      quote:
        'Ward and district urban modernization in New Delhi municipal council area subject to audit committee review',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
  ];

  it('generates all 8 canonical storyboard steps with 100% provenance verification', () => {
    const storyboard = buildDocumentStoryboard(verifiedFacts, {
      documentId: 'doc-gold-ndmc',
      documentTitle: 'NDMC Budget Speech 2026-27',
      fiscalPeriod: '2026-27',
    });

    expect(storyboard.documentId).toBe('doc-gold-ndmc');
    expect(storyboard.title).toBe('NDMC Budget Speech 2026-27');
    expect(storyboard.steps.length).toBe(8);

    // Verify all 8 canonical step keys in correct sequence
    const expectedKeys = [
      'what_is_this',
      'big_numbers',
      'where_money_goes',
      'what_changed',
      'when_things_happen',
      'where',
      'who',
      'things_to_know',
    ];
    expect(storyboard.steps.map((s) => s.key)).toEqual(expectedKeys);

    // Provenance validation: every single claim references verified fact IDs
    const allClaims = storyboard.steps.flatMap((s) => s.claims);
    expect(allClaims.length).toBeGreaterThanOrEqual(8);
    expect(allClaims.every((c) => c.isVerified)).toBe(true);
    expect(allClaims.every((c) => c.factIds.length > 0)).toBe(true);
    expect(storyboard.provenancePassRate).toBe(1.0);
  });

  it('rejects unverified facts from contaminating storyboard claims', () => {
    const unverifiedFact: DocumentFactDetail = {
      id: 'unverified-hallucinated-fact',
      label: 'Secret Phantom Budget',
      type: 'financial_total',
      value: 9999999,
      unit: 'crore',
      currency: 'INR',
      period: null,
      page: 1,
      quote: 'Fabricated quote never present in document',
      verified: false,
      verificationMethod: 'unverified',
      failReason: 'VALUE_NOT_IN_QUOTE',
    };

    const storyboard = buildDocumentStoryboard([...verifiedFacts, unverifiedFact]);
    const allClaims = storyboard.steps.flatMap((s) => s.claims);

    expect(allClaims.some((c) => c.factIds.includes('unverified-hallucinated-fact'))).toBe(false);
  });
});
