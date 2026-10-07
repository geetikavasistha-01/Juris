import type { DocumentFactDetail } from './documents.js';

export interface ChartSeriesDataPoint {
  id: string;
  name: string;
  value: number;
  unit: string | null;
  currency: string | null;
  page: number;
  quote: string;
  verified: boolean;
}

export interface PreparedBarChartData {
  status: 'ready' | 'empty';
  title: string;
  unit: string | null;
  currency: string | null;
  categories: string[];
  values: number[];
  items: ChartSeriesDataPoint[];
  excludedCount: number;
  excludedReason?: string;
  emptyReason?: string;
}

export interface PreparedTrendChartData {
  status: 'ready' | 'empty';
  title: string;
  unit: string | null;
  currency: string | null;
  periods: string[];
  values: number[];
  excludedCount: number;
  excludedReason?: string;
  emptyReason?: string;
}

export interface CategoryFactCount {
  category: string;
  count: number;
  verifiedCount: number;
  percentage: number;
}

export interface PreparedCategoryCountData {
  status: 'ready' | 'empty';
  title: string;
  description: string;
  totalFacts: number;
  categories: CategoryFactCount[];
  treemapData: Array<{ name: string; value: number }>;
  emptyReason?: string;
}

/**
 * Normalizes a unit string for uniform comparison (e.g., 'crore', 'Crore', 'cr' -> 'crore').
 */
export function normalizeUnit(unit: string | null | undefined): string {
  if (!unit) return 'unitless';
  const u = unit.toLowerCase().trim();
  if (u === 'crore' || u === 'crores' || u === 'cr') return 'crore';
  if (u === 'lakh' || u === 'lakhs' || u === 'l') return 'lakh';
  if (u === 'percent' || u === '%' || u === 'percentage') return 'percent';
  if (u === 'km' || u === 'kilometer' || u === 'kilometres') return 'km';
  if (u === 'count' || u === 'number' || u === 'units') return 'count';
  return u;
}

/**
 * Normalizes a currency string (e.g., 'INR', '₹', 'Rs', 'rupees' -> 'INR').
 */
export function normalizeCurrency(curr: string | null | undefined): string {
  if (!curr) return 'NONE';
  const c = curr.toUpperCase().trim();
  if (c === 'INR' || c === '₹' || c === 'RS' || c === 'RS.' || c === 'RUPEES') return 'INR';
  if (c === 'USD' || c === '$' || c === 'DOLLAR') return 'USD';
  return c;
}

/**
 * Prepares Bar Chart data for top quantified allocations with strict correctness guards:
 * 1. ONLY verified facts (verified === true) are included.
 * 2. Enforces single unit and single currency per chart (never mixes crore with km or percent).
 * 3. Shows an honest empty state explaining why if no valid uniform facts exist.
 */
export function prepareTopAllocationsData(
  facts: DocumentFactDetail[],
  maxItems = 8,
): PreparedBarChartData {
  // 1. Filter strictly for verified numeric facts
  const verifiedNumericFacts = facts.filter(
    (f) =>
      f.verified === true &&
      f.value !== null &&
      typeof f.value === 'number' &&
      !Number.isNaN(f.value) &&
      f.value > 0,
  );

  if (verifiedNumericFacts.length === 0) {
    const unverifiedCount = facts.filter(
      (f) => !f.verified && typeof f.value === 'number' && !Number.isNaN(f.value),
    ).length;
    return {
      status: 'empty',
      title: 'Top Quantitative Allocations',
      unit: null,
      currency: null,
      categories: [],
      values: [],
      items: [],
      excludedCount: facts.length,
      emptyReason:
        unverifiedCount > 0
          ? `All ${unverifiedCount} numerical facts in this document are unverified or unapproved. Excluded to ensure verifiability (VIZ-01).`
          : 'No quantified numerical facts were extracted from this document.',
    };
  }

  // Filter out aggregate totals so individual allocations and aggregate sums don't share a ranking
  const lineItemFacts = verifiedNumericFacts.filter(
    (f) => f.type !== 'financial_total' && f.type !== 'total',
  );
  const factsToRank = lineItemFacts.length > 0 ? lineItemFacts : verifiedNumericFacts;

  // 2. Identify dominant unit and currency pairing
  const pairCounts = new Map<string, { count: number; unit: string; currency: string }>();
  for (const f of factsToRank) {
    const normUnit = normalizeUnit(f.unit);
    const normCurr = normalizeCurrency(f.currency);
    const key = `${normCurr}|${normUnit}`;
    const current = pairCounts.get(key) || { count: 0, unit: normUnit, currency: normCurr };
    current.count += 1;
    pairCounts.set(key, current);
  }

  let dominantPair = '';
  let maxCount = 0;
  for (const [key, val] of pairCounts.entries()) {
    if (val.count > maxCount) {
      maxCount = val.count;
      dominantPair = key;
    }
  }

  const parts = dominantPair.split('|');
  const dominantCurr = parts[0] ?? 'NONE';
  const dominantUnit = parts[1] ?? 'unitless';

  // Filter strictly to the dominant uniform unit/currency
  const uniformFacts = factsToRank.filter((f) => {
    return normalizeCurrency(f.currency) === dominantCurr && normalizeUnit(f.unit) === dominantUnit;
  });

  const excludedCount = facts.length - uniformFacts.length;

  if (uniformFacts.length === 0) {
    return {
      status: 'empty',
      title: 'Top Quantitative Allocations',
      unit: null,
      currency: null,
      categories: [],
      values: [],
      items: [],
      excludedCount: facts.length,
      emptyReason:
        'Extracted verified facts contain conflicting incompatible units with no clear financial series.',
    };
  }

  // Sort descending by value
  const sorted = [...uniformFacts]
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, maxItems);

  const items: ChartSeriesDataPoint[] = sorted.map((f) => ({
    id: f.id,
    name: f.quote.length > 28 ? `${f.quote.substring(0, 26)}...` : f.quote,
    value: f.value as number,
    unit: f.unit,
    currency: f.currency,
    page: f.page,
    quote: f.quote,
    verified: f.verified,
  }));

  const unitLabel = dominantCurr !== 'NONE' ? `${dominantCurr} (${dominantUnit})` : dominantUnit;

  return {
    status: 'ready',
    title: `Top Allocations (${unitLabel})`,
    unit: dominantUnit === 'unitless' ? null : dominantUnit,
    currency: dominantCurr === 'NONE' ? null : dominantCurr,
    categories: items.map((i) => i.name),
    values: items.map((i) => i.value),
    items,
    excludedCount,
    excludedReason:
      excludedCount > 0
        ? `${excludedCount} facts in other units, aggregate totals, or unverified facts not shown in this chart.`
        : undefined,
  };
}

/**
 * Prepares Temporal Trend Line Chart data:
 * 1. ONLY verified facts with non-empty period citations.
 * 2. Enforces single unit and single currency.
 */
export function prepareTemporalTrendData(facts: DocumentFactDetail[]): PreparedTrendChartData {
  const verifiedFactsWithPeriod = facts.filter(
    (f) =>
      f.verified === true &&
      Boolean(f.period) &&
      f.value !== null &&
      typeof f.value === 'number' &&
      !Number.isNaN(f.value) &&
      f.value > 0,
  );

  if (verifiedFactsWithPeriod.length === 0) {
    return {
      status: 'empty',
      title: 'Allocations Across Fiscal Periods',
      unit: null,
      currency: null,
      periods: [],
      values: [],
      excludedCount: facts.length,
      emptyReason: 'No verified numerical facts with explicit fiscal period citations.',
    };
  }

  // Find dominant unit/currency for period facts
  const pairCounts = new Map<string, number>();
  for (const f of verifiedFactsWithPeriod) {
    const key = `${normalizeCurrency(f.currency)}|${normalizeUnit(f.unit)}`;
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  }

  let dominantKey = '';
  let maxCount = 0;
  for (const [key, count] of pairCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      dominantKey = key;
    }
  }

  const parts = dominantKey.split('|');
  const dominantCurr = parts[0] ?? 'NONE';
  const dominantUnit = parts[1] ?? 'unitless';
  const uniformPeriodFacts = verifiedFactsWithPeriod.filter(
    (f) => normalizeCurrency(f.currency) === dominantCurr && normalizeUnit(f.unit) === dominantUnit,
  );

  // Group by period
  const periodMap = new Map<string, number>();
  for (const f of uniformPeriodFacts) {
    const period = f.period as string;
    periodMap.set(period, (periodMap.get(period) || 0) + (f.value || 0));
  }

  const periods = Array.from(periodMap.keys()).sort();
  const values = periods.map((p) => periodMap.get(p) || 0);

  const unitLabel = dominantCurr !== 'NONE' ? `${dominantCurr} (${dominantUnit})` : dominantUnit;
  const excludedCount = facts.length - uniformPeriodFacts.length;

  return {
    status: 'ready',
    title: `Allocations Across Fiscal Periods (${unitLabel})`,
    unit: dominantUnit === 'unitless' ? null : dominantUnit,
    currency: dominantCurr === 'NONE' ? null : dominantCurr,
    periods,
    values,
    excludedCount,
    excludedReason:
      excludedCount > 0
        ? `${excludedCount} facts without explicit period citations or in other units not shown in this trend.`
        : undefined,
  };
}

/**
 * Prepares Category Fact Counts (Thematic Weight):
 * Explicitly measures FACT COUNTS by category/type, NOT budget or monetary share.
 */
export function prepareCategoryFactCounts(facts: DocumentFactDetail[]): PreparedCategoryCountData {
  if (facts.length === 0) {
    return {
      status: 'empty',
      title: 'Fact Counts by Category',
      description: 'Distribution of extracted civic facts across document topic areas.',
      totalFacts: 0,
      categories: [],
      treemapData: [],
      emptyReason: 'No facts extracted from document.',
    };
  }

  const categoryMap = new Map<string, { count: number; verifiedCount: number }>();

  for (const f of facts) {
    const cat = (f.type || 'GENERAL').toUpperCase();
    const current = categoryMap.get(cat) || { count: 0, verifiedCount: 0 };
    current.count += 1;
    if (f.verified) {
      current.verifiedCount += 1;
    }
    categoryMap.set(cat, current);
  }

  const total = facts.length;
  const categories: CategoryFactCount[] = Array.from(categoryMap.entries())
    .map(([category, stats]) => ({
      category,
      count: stats.count,
      verifiedCount: stats.verifiedCount,
      percentage: Math.round((stats.count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);

  const treemapData = categories.map((c) => ({
    name: `${c.category} (${c.count} facts)`,
    value: c.count,
  }));

  return {
    status: 'ready',
    title: 'Fact Counts by Category (Thematic Weight)',
    description:
      'Proportion of total extracted facts per topic area (counts, not expenditure share).',
    totalFacts: total,
    categories,
    treemapData,
  };
}
