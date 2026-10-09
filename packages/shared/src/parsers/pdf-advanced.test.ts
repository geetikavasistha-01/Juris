import { describe, it, expect } from 'vitest';
import {
  detectReadingOrder,
  stripHeadersAndFooters,
  reconstructTableWithScale,
  runMultiPassPdfPipeline,
} from './pdf-advanced.js';

describe('Advanced PDF Extraction Engine', () => {
  it('correctly detects multi-column reading order across two distinct columns', () => {
    // 6 items in left column (x=50), 6 items in right column (x=350)
    const items = [
      { str: 'Right Top Paragraph', x: 350, y: 700, width: 200, height: 12 },
      { str: 'Left Top Paragraph', x: 50, y: 700, width: 200, height: 12 },
      { str: 'Left Middle Paragraph', x: 50, y: 650, width: 200, height: 12 },
      { str: 'Right Middle Paragraph', x: 350, y: 650, width: 200, height: 12 },
      { str: 'Left Bottom Paragraph', x: 50, y: 600, width: 200, height: 12 },
      { str: 'Right Bottom Paragraph', x: 350, y: 600, width: 200, height: 12 },
      { str: 'Left Extra 1', x: 50, y: 550, width: 200, height: 12 },
      { str: 'Right Extra 1', x: 350, y: 550, width: 200, height: 12 },
      { str: 'Left Extra 2', x: 50, y: 500, width: 200, height: 12 },
      { str: 'Right Extra 2', x: 350, y: 500, width: 200, height: 12 },
      { str: 'Left Extra 3', x: 50, y: 450, width: 200, height: 12 },
      { str: 'Right Extra 3', x: 350, y: 450, width: 200, height: 12 },
    ];

    const readingOrder = detectReadingOrder(items, 612);

    expect(readingOrder[0]).toBe('Left Top Paragraph');
    expect(readingOrder[1]).toBe('Left Middle Paragraph');
    expect(readingOrder[2]).toBe('Left Bottom Paragraph');
    // Right column items appear after all left column items
    const rightTopIndex = readingOrder.indexOf('Right Top Paragraph');
    const leftBottomIndex = readingOrder.indexOf('Left Extra 3');
    expect(rightTopIndex).toBeGreaterThan(leftBottomIndex);
  });

  it('strips running headers and footers that repeat across pages', () => {
    const pages = [
      {
        pageNumber: 1,
        lines: [
          'NDMC MUNICIPAL BUDGET 2026-27',
          'First page substantive civic narrative content.',
          'Page 1 of 3',
        ],
      },
      {
        pageNumber: 2,
        lines: [
          'NDMC MUNICIPAL BUDGET 2026-27',
          'Second page substantive civic narrative content.',
          'Page 2 of 3',
        ],
      },
      {
        pageNumber: 3,
        lines: [
          'NDMC MUNICIPAL BUDGET 2026-27',
          'Third page substantive civic narrative content.',
          'Page 3 of 3',
        ],
      },
    ];

    const cleaned = stripHeadersAndFooters(pages);

    expect(cleaned.length).toBe(3);
    for (const p of cleaned) {
      expect(p.strippedHeader).toBe('NDMC MUNICIPAL BUDGET 2026-27');
      expect(p.contentLines).not.toContain('NDMC MUNICIPAL BUDGET 2026-27');
      expect(p.contentLines.some((l) => l.includes('substantive civic'))).toBe(true);
    }
  });

  it('reconstructs tabular data and propagates unit scale (crore)', () => {
    const tableText = `Department    Capital Outlay    Revenue Outlay
Education     12.50             105.50
Health        15.20             80.30`;

    const result = reconstructTableWithScale(tableText, 'Expenditure Head (Rs in Crore)');

    expect(result.unitLabel).toBe('crore');
    expect(result.unitScale).toBe(10000000);
    expect(result.headers).toEqual(['Department', 'Capital Outlay', 'Revenue Outlay']);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]).toEqual(['Education', 12.5, 105.5]);
  });

  it('executes 7-pass pipeline and verifies candidates with 100% precision', () => {
    const samplePages = [
      {
        pageNumber: 1,
        lines: [
          'NDMC MUNICIPAL BUDGET 2026-27',
          'Total Estimated Expenditure: Rs. 5810.02 Crore against previous year.',
          'Medical Services Department allocation is Rs. 118.33 Crore for hospitals.',
          'Page 1 of 2',
        ],
      },
      {
        pageNumber: 2,
        lines: [
          'NDMC MUNICIPAL BUDGET 2026-27',
          'Road Infrastructure Works received Rs. 250.00 Crore for smart roads.',
          'Solar Power Generation received Rs. 45.00 Crore in green budget.',
          'Page 2 of 2',
        ],
      },
    ];

    const facts = runMultiPassPdfPipeline(samplePages);

    expect(facts.length).toBeGreaterThanOrEqual(4);
    expect(facts.every((f) => f.verified)).toBe(true);
    expect(facts.every((f) => f.currency === 'INR')).toBe(true);
    expect(facts.some((f) => f.value === 5810.02 && f.unit === 'crore')).toBe(true);
  });
});
