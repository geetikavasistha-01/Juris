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
      type: 'HEALTH',
      value: 120.5,
      unit: 'crore',
      currency: 'INR',
      period: '2026-27',
      page: 12,
      quote: 'Rs 120.5 crore allocated to health services',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: 'a2222222-2222-2222-2222-222222222222',
      type: 'INFRASTRUCTURE',
      value: 450.0,
      unit: 'crore',
      currency: 'INR',
      period: '2026-27',
      page: 18,
      quote: 'Rs 450 crore allocated for road improvement',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: 'a3333333-3333-3333-3333-333333333333',
      type: 'EDUCATION',
      value: 80.0,
      unit: 'crore',
      currency: 'INR',
      period: '2025-26',
      page: 24,
      quote: 'Rs 80 crore allocated for primary schools',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: 'a4444444-4444-4444-4444-444444444444',
      type: 'INFRASTRUCTURE',
      value: 1200.0,
      unit: 'km', // MIXED NON-FINANCIAL UNIT
      currency: null,
      period: '2026-27',
      page: 30,
      quote: '1200 km of new roads constructed',
      verified: true,
      verificationMethod: 'quote_on_page',
      failReason: null,
    },
    {
      id: 'a5555555-5555-5555-5555-555555555555',
      type: 'DEFENSE',
      value: 9999.0, // UNVERIFIED FACT MUST BE EXCLUDED
      unit: 'crore',
      currency: 'INR',
      period: '2026-27',
      page: 45,
      quote: 'Unverified Rs 9999 crore assertion',
      verified: false,
      verificationMethod: 'quote_on_page',
      failReason: 'Quote not found on page',
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
    });

    it('returns an honest empty state when all numeric facts are unverified', () => {
      const unverifiedFacts: DocumentFactDetail[] = [
        {
          id: 'b1111111-1111-1111-1111-111111111111',
          type: 'FINANCE',
          value: 500,
          unit: 'crore',
          currency: 'INR',
          period: '2026-27',
          page: 5,
          quote: 'Unverified 500 cr',
          verified: false,
          verificationMethod: 'quote_on_page',
          failReason: 'Verification failed',
        },
      ];

      const result = prepareTopAllocationsData(unverifiedFacts);
      expect(result.status).toBe('empty');
      expect(result.emptyReason).toContain('unverified');
    });
  });

  describe('prepareTemporalTrendData', () => {
    it('aggregates only verified facts with period citations and uniform units', () => {
      const result = prepareTemporalTrendData(mockFacts);
      expect(result.status).toBe('ready');
      expect(result.currency).toBe('INR');
      expect(result.unit).toBe('crore');
      expect(result.periods).toEqual(['2025-26', '2026-27']);
      // 2025-26 has 80.0; 2026-27 has 120.5 + 450.0 = 570.5 (excluding 1200 km and unverified 9999)
      expect(result.values).toEqual([80.0, 570.5]);
    });
  });

  describe('prepareCategoryFactCounts (Thematic Weight)', () => {
    it('measures fact COUNTS and proportions, not budget share', () => {
      const result = prepareCategoryFactCounts(mockFacts);
      expect(result.status).toBe('ready');
      expect(result.title).toContain('Fact Counts by Category');
      expect(result.description).toContain('counts, not expenditure share');
      expect(result.totalFacts).toBe(5);

      const infra = result.categories.find((c) => c.category === 'INFRASTRUCTURE');
      expect(infra).toBeDefined();
      expect(infra?.count).toBe(2); // 2 facts total
      expect(infra?.verifiedCount).toBe(2);
      expect(infra?.percentage).toBe(40.0);
    });
  });
});
