import { describe, it, expect } from 'vitest';
import type { DocumentFactDetail } from './documents.js';
import {
  prepareTopAllocationsData,
  prepareTemporalTrendData,
  prepareCategoryFactCounts,
  normalizeUnit,
  normalizeCurrency,
} from './visuals.js';

describe('visuals data preparation & correctness guards', () => {
  const mockFacts: DocumentFactDetail[] = [
    {
      id: 'a1111111-1111-1111-1111-111111111111',
      label: 'Health Services Allocation',
      type: 'allocation',
      value: 120.5,
      unit: 'crore',
      currency: 'INR',
      period: { basis: 'BE', fiscalYear: '2026-27' },
      page: 12,
      quote: 'Rs 120.5 crore allocated to health services',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: 'a2222222-2222-2222-2222-222222222222',
      label: 'Road Improvement Allocation',
      type: 'allocation',
      value: 450.0,
      unit: 'crore',
      currency: 'INR',
      period: { basis: 'BE', fiscalYear: '2026-27' },
      page: 18,
      quote: 'Rs 450 crore allocated for road improvement',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: 'a3333333-3333-3333-3333-333333333333',
      label: 'Primary Schools Allocation',
      type: 'allocation',
      value: 80.0,
      unit: 'crore',
      currency: 'INR',
      period: { basis: 'RE', fiscalYear: '2025-26' },
      page: 24,
      quote: 'Rs 80 crore allocated for primary schools',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: 'a4444444-4444-4444-4444-444444444444',
      label: 'Road Construction Length',
      type: 'physical_quantity',
      value: 1200.0,
      unit: 'km', // MIXED NON-FINANCIAL UNIT
      currency: null,
      period: { basis: 'BE', fiscalYear: '2026-27' },
      page: 30,
      quote: '1200 km of new roads constructed',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: 'a5555555-5555-5555-5555-555555555555',
      label: 'Defense Assertion',
      type: 'expenditure',
      value: 9999.0, // UNVERIFIED FACT MUST BE EXCLUDED
      unit: 'crore',
      currency: 'INR',
      period: { basis: 'BE', fiscalYear: '2026-27' },
      page: 45,
      quote: 'Unverified Rs 9999 crore assertion',
      verified: false,
      verificationMethod: 'quote_on_page',
      failReason: 'QUOTE_NOT_ON_SINGLE_PAGE',
    },
  ];

  it('normalizes units and currencies accurately', () => {
    expect(normalizeUnit('Crores')).toBe('crore');
    expect(normalizeUnit('cr')).toBe('crore');
    expect(normalizeUnit('km')).toBe('km');
    expect(normalizeCurrency('₹')).toBe('INR');
    expect(normalizeCurrency('Rs.')).toBe('INR');
    expect(normalizeCurrency('USD')).toBe('USD');
  });

  describe('prepareTopAllocationsData', () => {
    it('strictly excludes unverified facts and non-dominant mixed units', () => {
      const result = prepareTopAllocationsData(mockFacts);
      expect(result.status).toBe('ready');
      expect(result.currency).toBe('INR');
      expect(result.unit).toBe('crore');

      // Unverified fact (value: 9999.0) must NOT be present
      expect(result.values).not.toContain(9999.0);

      // Incompatible non-currency unit fact (value: 1200.0 km) must NOT be present
      expect(result.values).not.toContain(1200.0);

      // Only verified INR crore facts (450.0, 120.5, 80.0) sorted descending
      expect(result.values).toEqual([450.0, 120.5, 80.0]);
      expect(result.items.length).toBe(3);
      expect(result.items[0]?.value).toBe(450.0);
      expect(result.items[0]?.page).toBe(18);

      // Excluded count should report exactly 2 excluded facts (1 km fact + 1 unverified)
      expect(result.excludedCount).toBe(2);
      expect(result.excludedReason).toContain('2 facts in other units');
    });

    it('excludes aggregate financial_total facts from departmental line-item allocations', () => {
      const factsWithTotal: DocumentFactDetail[] = [
        ...mockFacts,
        {
          id: 'total-1',
          label: 'Total BE Expenditure',
          type: 'financial_total',
          value: 5810.02,
          unit: 'crore',
          currency: 'INR',
          period: { basis: 'BE', fiscalYear: '2026-27' },
          page: 33,
          quote: 'The total expenditure for BE 2026-27 are Rs.5810.02 Crore',
          verified: true,
          verificationMethod: 'quote_on_page',
          failReason: null,
        },
      ];

      const result = prepareTopAllocationsData(factsWithTotal);
      expect(result.status).toBe('ready');
      // Total (5810.02) must not hijack the top line-item ranking
      expect(result.values).not.toContain(5810.02);
      expect(result.values).toEqual([450.0, 120.5, 80.0]);
    });

    it('returns an honest empty state when all numeric facts are unverified', () => {
      const unverifiedFacts: DocumentFactDetail[] = [
        {
          id: 'b1111111-1111-1111-1111-111111111111',
          label: 'Unverified Finance',
          type: 'expenditure',
          value: 500,
          unit: 'crore',
          currency: 'INR',
          period: { basis: 'BE', fiscalYear: '2026-27' },
          page: 5,
          quote: 'Unverified 500 cr',
          verified: false,
          verificationMethod: 'quote_on_page',
          failReason: 'QUOTE_NOT_ON_SINGLE_PAGE',
        },
      ];

      const result = prepareTopAllocationsData(unverifiedFacts);
      expect(result.status).toBe('empty');
      expect(result.emptyReason).toContain('unverified');
      expect(result.excludedCount).toBe(1);
    });
  });

  describe('prepareTemporalTrendData', () => {
    it('aggregates multi-year facts accurately with explicit period grouping', () => {
      const result = prepareTemporalTrendData(mockFacts);
      expect(result.status).toBe('ready');
      expect(result.periods).toEqual(['BE 2026-27', 'RE 2025-26']);
      // BE 2026-27 = 120.5 + 450.0 = 570.5
      // RE 2025-26 = 80.0
      expect(result.values).toEqual([570.5, 80.0]);
    });
  });

  describe('prepareCategoryFactCounts', () => {
    it('computes category share and counts without monetary conflation', () => {
      const result = prepareCategoryFactCounts(mockFacts);
      expect(result.status).toBe('ready');
      expect(result.totalFacts).toBe(5);
      const allocCat = result.categories.find((c) => c.category === 'allocation');
      expect(allocCat?.count).toBe(3);
      expect(allocCat?.verifiedCount).toBe(3);
    });
  });
});
