import { describe, it, expect } from 'vitest';
import {
  parseCsvTable,
  inferColumnType,
  validateGeoJson,
  validateImageDimensions,
  executeQueryPlanOnTable,
  type TableData,
} from './index.js';

describe('Multimodal Ingestion Pipeline (CSV, GeoJSON, Image & Query Engine)', () => {
  describe('CSV / Tabular Parser & Type Inference (ING-05)', () => {
    const sampleCsv = `Department,Budget 2024,Budget 2025,Growth Rate,Approved Date
Education,45000000,52000000,15.5%,2024-04-01
Healthcare,30000000,34500000,15.0%,2024-04-01
Infrastructure,25000000,28000000,12.0%,2024-04-02
Public Safety,15000000,16500000,10.0%,2024-04-03`;

    it('parses CSV structure into typed columns and rows within limits', () => {
      const table = parseCsvTable(sampleCsv);
      expect(table.headers).toEqual([
        'Department',
        'Budget 2024',
        'Budget 2025',
        'Growth Rate',
        'Approved Date',
      ]);
      expect(table.rowCount).toBe(4);
      expect(table.columnCount).toBe(5);
      expect(table.columns[0]?.inferredType).toBe('string');
      expect(table.columns[1]?.inferredType).toBe('number');
      expect(table.columns[2]?.inferredType).toBe('number');
      expect(table.columns[3]?.inferredType).toBe('percentage');
      expect(table.columns[4]?.inferredType).toBe('date');
    });

    it('infers individual column types accurately', () => {
      expect(inferColumnType(['$45,000,000', '$30,000,000', '$25,000,000'])).toBe('currency');
      expect(inferColumnType(['15.5%', '10.0%', '8.2%'])).toBe('percentage');
      expect(inferColumnType(['2024-01-15', '2024-02-20', '2024-03-30'])).toBe('date');
      expect(inferColumnType(['12345', '67890', '54321'])).toBe('number');
      expect(inferColumnType(['Ward 1', 'Ward 2', 'Ward 3'])).toBe('string');
    });

    it('rejects tables exceeding maximum column count limit', () => {
      const wideRow = Array.from({ length: 250 }, (_, i) => `Col${i}`).join(',');
      expect(() => parseCsvTable(wideRow, { maxColumns: 200 })).toThrowError(
        'TABLE_LIMIT_EXCEEDED',
      );
    });
  });

  describe('Geospatial Validator (ING-07)', () => {
    const validGeoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'ward-01',
          properties: { name: 'Ward 1', budget: 45000000 },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [77.1, 28.5],
                [77.2, 28.5],
                [77.2, 28.6],
                [77.1, 28.6],
                [77.1, 28.5],
              ],
            ],
          },
        },
      ],
    };

    it('validates compliant GeoJSON FeatureCollection', () => {
      const result = validateGeoJson(JSON.stringify(validGeoJson));
      expect(result.isValid).toBe(true);
      expect(result.featureCount).toBe(1);
      expect(result.geometryTypes).toContain('Polygon');
      expect(result.numericProperties).toContain('budget');
    });

    it('rejects invalid GeoJSON geometry or schema', () => {
      const invalidGeo = { type: 'InvalidType', data: [] };
      expect(() => validateGeoJson(JSON.stringify(invalidGeo))).toThrowError('INVALID_GEOMETRY');
    });

    it('rejects GeoJSON exceeding maximum feature limit', () => {
      const bigFeatures = Array.from({ length: 60 }, (_, i) => ({
        type: 'Feature',
        id: `f-${i}`,
        geometry: { type: 'Point', coordinates: [77.0, 28.0] },
        properties: {},
      }));
      const bigGeo = { type: 'FeatureCollection', features: bigFeatures };
      expect(() => validateGeoJson(JSON.stringify(bigGeo), { maxFeatures: 50 })).toThrowError(
        'GEO_FEATURE_LIMIT_EXCEEDED',
      );
    });
  });

  describe('Image Dimension & Decompression Bomb Guard (ING-06)', () => {
    it('accepts safe image dimensions within bounds', () => {
      expect(validateImageDimensions(4000, 3000)).toEqual({ valid: true, pixels: 12000000 });
    });

    it('rejects images exceeding maximum pixel count or side length', () => {
      expect(() => validateImageDimensions(12000, 4000)).toThrowError('IMAGE_DIMENSIONS_EXCEEDED');
      expect(() => validateImageDimensions(7000, 7000)).toThrowError('IMAGE_DIMENSIONS_EXCEEDED');
    });
  });

  describe('Deterministic Tabular Query Engine (CHT-05)', () => {
    const table: TableData = {
      headers: ['Department', 'Sector', 'Budget'],
      columns: [
        { name: 'Department', inferredType: 'string', index: 0 },
        { name: 'Sector', inferredType: 'string', index: 1 },
        { name: 'Budget', inferredType: 'number', index: 2 },
      ],
      rows: [
        ['Schools', 'Education', 45000000],
        ['Clinics', 'Health', 30000000],
        ['Hospitals', 'Health', 15000000],
        ['Roads', 'Infrastructure', 25000000],
      ],
      rowCount: 4,
      columnCount: 3,
    };

    it('executes aggregation query with filters and group-by deterministically', () => {
      const result = executeQueryPlanOnTable(table, {
        version: 1,
        filters: [{ column: 'Budget', op: 'gte', value: 10000000 }],
        groupBy: ['Sector'],
        aggregates: [
          { fn: 'sum', column: 'Budget', alias: 'total_budget' },
          { fn: 'count', alias: 'dept_count' },
        ],
        orderBy: [{ key: 'total_budget', direction: 'desc' }],
        limit: 10,
      });

      expect(result.rows.length).toBe(3);
      // Health total: 30M + 15M = 45M
      // Education total: 45M
      // Infrastructure total: 25M
      const healthRow = result.rows.find((r) => r.Sector === 'Health');
      expect(healthRow?.total_budget).toBe(45000000);
      expect(healthRow?.dept_count).toBe(2);
    });
  });
});
