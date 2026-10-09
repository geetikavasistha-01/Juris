import { describe, it, expect } from 'vitest';
import { parseCsvTable } from './csv-parser.js';
import {
  sanitizeCsvValue,
  sanitizeCsvExport,
  profileDataset,
  verifyDualComputation,
  buildCsvSpecificCharts,
} from './csv-dual-computation.js';

describe('Phase 7: CSV Modality & Dual-Computation Engine', () => {
  const sampleCsvData = `Ward,CapitalOutlay,RevenueOutlay,Beneficiaries
Ward 1,1200000,500000,150
Ward 2,2400000,850000,320
Ward 3,1800000,600000,210
Ward 4,950000,320000,110
Ward 5,3100000,1100000,450
Ward 6,2800000,980000,390
Ward 7,1500000,550000,180
Ward 8,2200000,780000,290`;

  const parsedTable = parseCsvTable(sampleCsvData);

  it('correctly parses tabular dataset with inferred data types', () => {
    expect(parsedTable.rowCount).toBe(8);
    expect(parsedTable.columnCount).toBe(4);
    expect(parsedTable.headers).toEqual([
      'Ward',
      'CapitalOutlay',
      'RevenueOutlay',
      'Beneficiaries',
    ]);
    expect(parsedTable.columns[1]?.inferredType).toBe('number');
  });

  it('computes dataset profile including quartiles, IQR outliers, and correlations', () => {
    const profile = profileDataset(parsedTable);

    expect(profile.totalRows).toBe(8);
    expect(profile.totalColumns).toBe(4);
    expect(profile.geoColumns).toContain('Ward');

    // CapitalOutlay statistics
    const capStats = profile.numericSummaries['CapitalOutlay'];
    expect(capStats).toBeDefined();
    expect(capStats!.min).toBe(950000);
    expect(capStats!.max).toBe(3100000);
    expect(capStats!.mean).toBeGreaterThan(1500000);
    expect(capStats!.q1).toBeLessThan(capStats!.q3);
    expect(capStats!.iqr).toBe(capStats!.q3 - capStats!.q1);
    expect(capStats!.nullRate).toBe(0);

    // Pearson correlations between CapitalOutlay and RevenueOutlay
    const capRevCorr = profile.correlations.find(
      (c) =>
        (c.columnA === 'CapitalOutlay' && c.columnB === 'RevenueOutlay') ||
        (c.columnA === 'RevenueOutlay' && c.columnB === 'CapitalOutlay'),
    );
    expect(capRevCorr).toBeDefined();
    expect(capRevCorr!.pearsonR).toBeGreaterThan(0.9); // High positive correlation
  });

  it('verifies that matching dual-computation returns COMPUTED proof type', () => {
    const jsSum = 15950000;
    const sqlSum = 15950000;

    const result = verifyDualComputation('Total Capital Outlay', jsSum, sqlSum);

    expect(result.agreed).toBe(true);
    expect(result.proofType).toBe('COMPUTED');
    expect(result.discrepancy).toBe(0);
    expect(result.rejectionReason).toBeUndefined();
  });

  it('GATE: Seeded arithmetic discrepancy between JS and SQL triggers automatic REJECTION', () => {
    const jsSum = 15950000;
    const seededDiscrepantSqlSum = 15950050; // Seeded arithmetic discrepancy of 50 units

    const result = verifyDualComputation('Total Capital Outlay', jsSum, seededDiscrepantSqlSum);

    expect(result.agreed).toBe(false);
    expect(result.proofType).toBe('REJECTED');
    expect(result.discrepancy).toBe(50);
    expect(result.rejectionReason).toContain('DUAL_COMPUTATION_MISMATCH');
    expect(result.rejectionReason).toContain('differ by 50');
  });

  it('neutralizes dangerous formula injection characters on CSV export', () => {
    const dangerousCell = '=cmd|"/C calc"!A0';
    const neutralized = sanitizeCsvValue(dangerousCell);
    expect(neutralized.startsWith("'=")).toBe(true);

    const plusFormula = '+2+5';
    expect(sanitizeCsvValue(plusFormula).startsWith("'+")).toBe(true);

    const atFormula = '@SUM(A1:A10)';
    expect(sanitizeCsvValue(atFormula).startsWith("'@")).toBe(true);

    // Export row table
    const tableWithInjection = [
      ['Ward', 'FormulaCell'],
      ['Ward 1', '=1+1'],
    ];
    const exportedCsv = sanitizeCsvExport(tableWithInjection);
    expect(exportedCsv).toContain("'=1+1");
  });

  it('generates CSV-specific distribution histogram and box plot visual specs', () => {
    const profile = profileDataset(parsedTable);
    const specs = buildCsvSpecificCharts(parsedTable, profile, 'doc-csv-01');

    expect(specs.length).toBeGreaterThanOrEqual(2);
    const histSpec = specs.find((s) => s.title.includes('Distribution Histogram'));
    const boxSpec = specs.find((s) => s.title.includes('Quartile Distribution'));

    expect(histSpec).toBeDefined();
    expect(boxSpec).toBeDefined();
    expect(histSpec!.series.every((p) => p.proofType === 'COMPUTED')).toBe(true);
    expect(boxSpec!.series.length).toBe(5); // Min, Q1, Median, Q3, Max
  });
});
