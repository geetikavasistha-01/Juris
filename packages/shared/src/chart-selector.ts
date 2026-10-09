import type { DocumentFactDetail } from './documents.js';
import type { ProofType } from './evidence.js';
import { isOverviewEligibleProofType } from './evidence.js';
import {
  type VisualSpec,
  type VisualKind,
  type VisualSeriesPoint,
  assertVisualSpecProvenance,
} from './visual-spec.js';
import { normalizeUnit, normalizeCurrency } from './visuals.js';

export interface ChartSelectorCandidate {
  spec: VisualSpec;
  kind: VisualKind;
  rank: number;
  reason: string;
  laymanQuestion: string;
}

export interface ChartSelectorOptions {
  includeEstimates?: boolean;
  maxCandidates?: number;
}

/**
 * Deterministically scans verified facts and returns ranked visual specifications (PRD Section 6.1).
 * Code chooses the charts based on data shape; the LLM never emits chart specs or numbers.
 */
export function selectVisualSpecs(
  facts: DocumentFactDetail[],
  options: ChartSelectorOptions = {},
): VisualSpec[] {
  const includeEstimates = options.includeEstimates ?? false;

  // 1. Filter facts for eligibility
  const eligibleFacts = facts.filter((f) => {
    // If fact has verified === true or an eligible proofType
    const proofType: ProofType =
      (f as { proofType?: ProofType }).proofType ?? (f.verified ? 'VERIFIED' : 'UNVERIFIABLE');
    return isOverviewEligibleProofType(proofType, includeEstimates);
  });

  const candidates: ChartSelectorCandidate[] = [];

  // Group quantitative facts by unit + currency
  const quantitativeFacts = eligibleFacts.filter(
    (f) => f.value !== null && typeof f.value === 'number' && !Number.isNaN(f.value) && f.value > 0,
  );

  const unitBuckets = new Map<string, DocumentFactDetail[]>();
  for (const fact of quantitativeFacts) {
    const key = `${normalizeUnit(fact.unit)}__${normalizeCurrency(fact.currency)}`;
    const bucket = unitBuckets.get(key) ?? [];
    bucket.push(fact);
    unitBuckets.set(key, bucket);
  }

  // Find the primary dominant unit bucket (e.g. crore INR)
  let dominantBucketKey = '';
  let maxCount = 0;
  for (const [key, items] of unitBuckets.entries()) {
    if (items.length > maxCount) {
      maxCount = items.length;
      dominantBucketKey = key;
    }
  }
  const dominantFacts = unitBuckets.get(dominantBucketKey) ?? [];

  // --------------------------------------------------------------------------
  // 1. Key Figures Strip (Always selected if at least 1 verified fact exists)
  // --------------------------------------------------------------------------
  if (quantitativeFacts.length > 0) {
    const topKeyFigures = [...quantitativeFacts]
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .slice(0, 4);

    const series: VisualSeriesPoint[] = topKeyFigures.map((f) => ({
      id: f.id,
      label: f.label,
      value: f.value!,
      unit: f.unit,
      currency: f.currency,
      factIds: [f.id],
      proofType: ((f as { proofType?: ProofType }).proofType ?? 'VERIFIED') as ProofType,
    }));

    const a11yTable = {
      headers: ['Headline Figure', 'Value', 'Unit', 'Page', 'Proof'],
      rows: topKeyFigures.map((f) => [
        f.label,
        f.value!,
        f.unit ?? 'N/A',
        f.page,
        (f as { proofType?: string }).proofType ?? 'VERIFIED',
      ]),
    };

    const spec: VisualSpec = {
      id: 'key-figures-strip',
      kind: 'key_figures_strip',
      title: 'Key Headline Figures',
      subtitle: 'Top verified quantifiable totals and allocations from the document',
      laymanQuestion: 'What are the headline numbers?',
      encodings: {
        value: 'value',
        unit: dominantFacts[0]?.unit,
        currency: dominantFacts[0]?.currency,
      },
      series,
      proofSummary: {
        totalPoints: series.length,
        verifiedCount: series.length,
        overallProofType: 'VERIFIED',
      },
      a11yTable,
      rank: 1,
    };
    assertVisualSpecProvenance(spec);
    candidates.push({
      spec,
      kind: 'key_figures_strip',
      rank: 1,
      reason: 'Headline metrics provide immediate orientation on key verified numbers',
      laymanQuestion: 'What are the headline numbers?',
    });
  }

  // --------------------------------------------------------------------------
  // 2. Treemap or Donut (Parts-to-Whole Allocation Breakdown)
  // --------------------------------------------------------------------------
  if (dominantFacts.length >= 2) {
    const sortedDominant = [...dominantFacts].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const totalVal = sortedDominant.reduce((acc, f) => acc + (f.value ?? 0), 0);

    if (sortedDominant.length <= 6) {
      // Donut chart candidate (2-6 parts)
      const series: VisualSeriesPoint[] = sortedDominant.map((f) => ({
        id: f.id,
        label: f.label,
        value: f.value!,
        formattedValue: `${f.value!.toLocaleString('en-IN')} ${f.unit ?? ''}`,
        unit: f.unit,
        currency: f.currency,
        factIds: [f.id],
        proofType: ((f as { proofType?: ProofType }).proofType ?? 'VERIFIED') as ProofType,
      }));

      const spec: VisualSpec = {
        id: 'allocation-donut',
        kind: 'donut_pie',
        title: 'Allocation Breakdown',
        subtitle: `Distribution across ${sortedDominant.length} primary expenditure categories`,
        laymanQuestion: 'How is the whole split?',
        encodings: { category: 'label', value: 'value', unit: dominantFacts[0]?.unit },
        series,
        proofSummary: {
          totalPoints: series.length,
          verifiedCount: series.length,
          overallProofType: 'VERIFIED',
        },
        a11yTable: {
          headers: ['Category', 'Value', 'Share (%)'],
          rows: sortedDominant.map((f) => [
            f.label,
            f.value!,
            `${((f.value! / totalVal) * 100).toFixed(1)}%`,
          ]),
        },
        rank: 2,
      };
      assertVisualSpecProvenance(spec);
      candidates.push({
        spec,
        kind: 'donut_pie',
        rank: 2,
        reason: 'Between 2 and 6 verified parts forming a coherent expenditure breakdown',
        laymanQuestion: 'How is the whole split?',
      });
    } else {
      // Treemap candidate (>6 parts)
      const topItems = sortedDominant.slice(0, 12);
      const series: VisualSeriesPoint[] = topItems.map((f) => ({
        id: f.id,
        label: f.label,
        value: f.value!,
        formattedValue: `${f.value!.toLocaleString('en-IN')} ${f.unit ?? ''}`,
        unit: f.unit,
        currency: f.currency,
        factIds: [f.id],
        proofType: ((f as { proofType?: ProofType }).proofType ?? 'VERIFIED') as ProofType,
      }));

      const spec: VisualSpec = {
        id: 'allocation-treemap',
        kind: 'treemap',
        title: 'Major Expenditure Outlays',
        subtitle: `Hierarchical breakdown of ${topItems.length} quantified allocations`,
        laymanQuestion: 'Which items take up most of the money?',
        encodings: { category: 'label', value: 'value', unit: dominantFacts[0]?.unit },
        series,
        proofSummary: {
          totalPoints: series.length,
          verifiedCount: series.length,
          overallProofType: 'VERIFIED',
        },
        a11yTable: {
          headers: ['Category', 'Value', 'Unit'],
          rows: topItems.map((f) => [f.label, f.value!, f.unit ?? '']),
        },
        rank: 2,
      };
      assertVisualSpecProvenance(spec);
      candidates.push({
        spec,
        kind: 'treemap',
        rank: 2,
        reason: 'More than 6 categorical parts best represented as an area-proportional treemap',
        laymanQuestion: 'Which items take up most of the money?',
      });
    }
  }

  // --------------------------------------------------------------------------
  // 3. Horizontal Ranked Bar (Top Allocations / Comparisons)
  // --------------------------------------------------------------------------
  if (dominantFacts.length >= 3) {
    const sortedByRank = [...dominantFacts]
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .slice(0, 8);

    const series: VisualSeriesPoint[] = sortedByRank.map((f) => ({
      id: f.id,
      label: f.label,
      value: f.value!,
      unit: f.unit,
      currency: f.currency,
      factIds: [f.id],
      proofType: ((f as { proofType?: ProofType }).proofType ?? 'VERIFIED') as ProofType,
    }));

    const spec: VisualSpec = {
      id: 'ranked-allocations-bar',
      kind: 'horizontal_ranked_bar',
      title: 'Top Ranked Allocations',
      subtitle: `Comparison of top ${sortedByRank.length} verified programs by scale`,
      laymanQuestion: 'Who is biggest and smallest?',
      encodings: { x: 'value', y: 'label', unit: dominantFacts[0]?.unit },
      series,
      proofSummary: {
        totalPoints: series.length,
        verifiedCount: series.length,
        overallProofType: 'VERIFIED',
      },
      a11yTable: {
        headers: ['Rank', 'Program / Allocation', 'Value', 'Unit'],
        rows: sortedByRank.map((f, idx) => [idx + 1, f.label, f.value!, f.unit ?? '']),
      },
      rank: 3,
    };
    assertVisualSpecProvenance(spec);
    candidates.push({
      spec,
      kind: 'horizontal_ranked_bar',
      rank: 3,
      reason:
        'Ranked comparison allows immediate visual contrast between largest and smallest funding priorities',
      laymanQuestion: 'Who is biggest and smallest?',
    });
  }

  // --------------------------------------------------------------------------
  // 4. Time Series Trend (Line or Slope Chart)
  // --------------------------------------------------------------------------
  const periodFacts = dominantFacts.filter((f) => {
    if (f.period && typeof f.period === 'object' && f.period.fiscalYear) return true;
    return false;
  });

  if (periodFacts.length >= 2) {
    const periodMap = new Map<string, DocumentFactDetail>();
    for (const f of periodFacts) {
      if (f.period && typeof f.period === 'object' && f.period.fiscalYear) {
        const p = f.period.fiscalYear;
        if (!periodMap.has(p)) {
          periodMap.set(p, f);
        }
      }
    }

    const uniquePeriods = Array.from(periodMap.keys()).sort();
    if (uniquePeriods.length >= 2) {
      const isMultiPoint = uniquePeriods.length >= 4;
      const chartKind: VisualKind = isMultiPoint ? 'line_area' : 'slope_chart';

      const series: VisualSeriesPoint[] = uniquePeriods.map((period) => {
        const f = periodMap.get(period)!;
        return {
          id: f.id,
          label: period,
          value: f.value!,
          period,
          unit: f.unit,
          currency: f.currency,
          factIds: [f.id],
          proofType: ((f as { proofType?: ProofType }).proofType ?? 'VERIFIED') as ProofType,
        };
      });

      const spec: VisualSpec = {
        id: isMultiPoint ? 'multi-year-trend' : 'fiscal-comparison-slope',
        kind: chartKind,
        title: isMultiPoint ? 'Multi-Period Fiscal Trajectory' : 'Fiscal Period Comparison',
        subtitle: `Trajectory across ${uniquePeriods.join(' → ')}`,
        laymanQuestion: isMultiPoint ? 'How has it moved over time?' : 'Which items rose or fell?',
        encodings: { x: 'period', y: 'value', unit: dominantFacts[0]?.unit },
        series,
        proofSummary: {
          totalPoints: series.length,
          verifiedCount: series.length,
          overallProofType: 'VERIFIED',
        },
        a11yTable: {
          headers: ['Period', 'Value', 'Unit'],
          rows: series.map((s) => [s.period ?? s.label, s.value, s.unit ?? '']),
        },
        rank: 4,
      };
      assertVisualSpecProvenance(spec);
      candidates.push({
        spec,
        kind: chartKind,
        rank: 4,
        reason: `${uniquePeriods.length} sequential fiscal periods detected in verified records`,
        laymanQuestion: isMultiPoint ? 'How has it moved over time?' : 'Which items rose or fell?',
      });
    }
  }

  // --------------------------------------------------------------------------
  // 5. Grouped Comparison or Variance Bar (Multi-Basis or Multi-Entity)
  // --------------------------------------------------------------------------
  if (dominantFacts.length >= 2) {
    const basisGroups = new Map<string, DocumentFactDetail[]>();
    for (const f of dominantFacts) {
      const b = (f.period && typeof f.period === 'object' && f.period.basis) || 'BE';
      const arr = basisGroups.get(b) ?? [];
      arr.push(f);
      basisGroups.set(b, arr);
    }

    // Candidate 5: Grouped comparison across programs
    const comparisonFacts = dominantFacts.slice(0, 6);
    const series: VisualSeriesPoint[] = comparisonFacts.map((f) => ({
      id: f.id,
      label: f.label,
      value: f.value!,
      formattedValue: `${f.value!.toLocaleString('en-IN')} ${f.unit ?? ''}`,
      unit: f.unit,
      currency: f.currency,
      factIds: [f.id],
      proofType: ((f as { proofType?: ProofType }).proofType ?? 'VERIFIED') as ProofType,
    }));

    const spec: VisualSpec = {
      id: 'grouped-program-comparison',
      kind: 'grouped_stacked_bar',
      title: 'Program Allocation Comparison',
      subtitle: `Side-by-side comparison across ${series.length} key budget programs`,
      laymanQuestion: 'How do key programs compare side by side?',
      encodings: { x: 'label', y: 'value', unit: dominantFacts[0]?.unit },
      series,
      proofSummary: {
        totalPoints: series.length,
        verifiedCount: series.length,
        overallProofType: 'VERIFIED',
      },
      a11yTable: {
        headers: ['Program', 'Value', 'Unit'],
        rows: series.map((s) => [s.label, s.value, s.unit ?? '']),
      },
      rank: 5,
    };
    assertVisualSpecProvenance(spec);
    candidates.push({
      spec,
      kind: 'grouped_stacked_bar',
      rank: 5,
      reason: 'Structured program categories enable side-by-side grouped evaluation',
      laymanQuestion: 'How do key programs compare side by side?',
    });
  }

  // --------------------------------------------------------------------------
  // 6. Bullet Gauge / Priority Execution Gauge
  // --------------------------------------------------------------------------
  if (dominantFacts.length >= 1) {
    const topMetric = dominantFacts[0]!;
    const series: VisualSeriesPoint[] = [
      {
        id: topMetric.id,
        label: topMetric.label,
        value: topMetric.value!,
        formattedValue: `${topMetric.value!.toLocaleString('en-IN')} ${topMetric.unit ?? ''}`,
        unit: topMetric.unit,
        currency: topMetric.currency,
        factIds: [topMetric.id],
        proofType: ((topMetric as { proofType?: ProofType }).proofType ?? 'VERIFIED') as ProofType,
      },
    ];

    const spec: VisualSpec = {
      id: 'priority-bullet-gauge',
      kind: 'bullet_gauge',
      title: `${topMetric.label} Benchmark Gauge`,
      subtitle: `Target performance metric against overall fiscal allocation`,
      laymanQuestion: 'Is the major program within expected benchmark levels?',
      encodings: { value: 'value', unit: topMetric.unit },
      series,
      proofSummary: {
        totalPoints: 1,
        verifiedCount: 1,
        overallProofType: 'VERIFIED',
      },
      a11yTable: {
        headers: ['Benchmark Target', 'Value', 'Unit'],
        rows: [[topMetric.label, topMetric.value!, topMetric.unit ?? '']],
      },
      rank: 6,
    };
    assertVisualSpecProvenance(spec);
    candidates.push({
      spec,
      kind: 'bullet_gauge',
      rank: 6,
      reason: 'Single high-impact quantitative metric suited for target-vs-actual gauge',
      laymanQuestion: 'Is the major program within expected benchmark levels?',
    });
  }

  // Sort candidates by rank ascending
  candidates.sort((a, b) => a.rank - b.rank);

  const maxItems = options.maxCandidates ?? 10;
  return candidates.slice(0, maxItems).map((c) => c.spec);
}
