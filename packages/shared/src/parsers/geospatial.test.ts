import { describe, it, expect } from 'vitest';
import {
  parseGeoJSON,
  parseKML,
  parseGPX,
  parseTopoJSON,
  reprojectWebMercatorToWGS84,
  normalizeWGS84Coordinate,
  disambiguatePlaceRecords,
  projectCoordinatesToSVGPath,
  validateArchiveSafety,
  validateShapefileArchiveFiles,
  NEUTRAL_BOUNDARY_DISCLAIMER,
} from './geospatial.js';
import { lookupPlace } from '@juris/geodata';

describe('Geospatial Modality & Offline Gazetteer (Phase 8)', () => {
  describe('GeoJSON Parser & Fact Extraction', () => {
    it('parses GeoJSON feature collection and extracts verified measure facts', () => {
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'dist_01',
            properties: {
              name: 'Pune',
              expenditure_crore: 450.5,
              population: 9429408,
            },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [73.5, 18.0],
                  [74.5, 18.0],
                  [74.5, 19.0],
                  [73.5, 19.0],
                  [73.5, 18.0],
                ],
              ],
            },
          },
        ],
      };

      const result = parseGeoJSON(geojson, 'pune_district_budget');
      expect(result.format).toBe('geojson');
      expect(result.featureCount).toBe(1);
      expect(result.features[0]!.id).toBe('dist_01');
      expect(result.features[0]!.bbox).toEqual([73.5, 18.0, 74.5, 19.0]);
      expect(result.features[0]!.centroid).toEqual([74.0, 18.5]);

      // Check extracted facts
      const facts = result.facts;
      expect(facts.length).toBe(2); // expenditure_crore and population
      const expFact = facts.find((f) => f.label.includes('expenditure_crore'));
      expect(expFact).toBeDefined();
      expect(expFact?.value).toBe(450.5);
      expect(expFact?.verified).toBe(true);
      expect(expFact?.proofType).toBe('VERIFIED');
      expect(expFact?.quote).toBe('expenditure_crore: 450.5');
    });
  });

  describe('Reprojection & Coordinate Normalization', () => {
    it('reprojects EPSG:3857 Web Mercator coordinates to WGS84', () => {
      // 0, 0 in Mercator is 0, 0 in WGS84
      const origin = reprojectWebMercatorToWGS84(0, 0);
      expect(origin[0]).toBe(0);
      expect(origin[1]).toBe(0);

      // Coordinates in meters (e.g. around London: -14000, 6710000)
      const london = reprojectWebMercatorToWGS84(-14000, 6710000);
      expect(london[0]).toBeCloseTo(-0.1257, 2);
      expect(london[1]).toBeCloseTo(51.5, 1);
    });

    it('normalizes out-of-bounds coordinates automatically', () => {
      // Large meter coordinates trigger reprojection
      const normalized = normalizeWGS84Coordinate([8571690, 2154935]);
      expect(normalized[0]).toBeGreaterThan(70);
      expect(normalized[0]).toBeLessThan(80);
      expect(normalized[1]).toBeGreaterThan(15);
      expect(normalized[1]).toBeLessThan(25);
    });
  });

  describe('KML & GPX Ingestion', () => {
    it('parses KML placemarks with attributes', () => {
      const kml = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Ward 14 Healthcare Center</name>
              <description>Budget: 12.5 crore</description>
              <Point>
                <coordinates>77.5946,12.9716,0</coordinates>
              </Point>
            </Placemark>
          </Document>
        </kml>`;

      const result = parseKML(kml, 'kml_health');
      expect(result.featureCount).toBe(1);
      expect(result.features[0]!.properties.name).toBe('Ward 14 Healthcare Center');
      expect(result.features[0]!.geometry?.type).toBe('Point');
      expect(result.features[0]!.geometry?.coordinates).toEqual([77.5946, 12.9716]);
    });

    it('parses GPX waypoints with coordinates and elevation', () => {
      const gpx = `<?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1">
          <wpt lat="19.0760" lon="72.8777">
            <name>Mumbai Marine Drive Survey Point</name>
            <ele>14.5</ele>
          </wpt>
        </gpx>`;

      const result = parseGPX(gpx, 'gpx_survey');
      expect(result.featureCount).toBe(1);
      expect(result.features[0]!.properties.name).toBe('Mumbai Marine Drive Survey Point');
      expect(result.features[0]!.properties.elevation).toBe(14.5);
      expect(result.features[0]!.geometry?.coordinates).toEqual([72.8777, 19.076]);
    });
  });

  describe('TopoJSON Decoding', () => {
    it('decodes TopoJSON arcs into GeoJSON polygon features', () => {
      const topojson = {
        type: 'Topology',
        transform: {
          scale: [0.01, 0.01],
          translate: [70.0, 15.0],
        },
        objects: {
          zones: {
            type: 'GeometryCollection',
            geometries: [
              {
                type: 'Polygon',
                id: 'zone_a',
                arcs: [[0]],
                properties: { zoneName: 'Zone Alpha', score: 98 },
              },
            ],
          },
        },
        arcs: [
          // Delta encoded coordinates: [0, 0], [100, 0], [0, 100], [-100, 0], [0, -100]
          [
            [0, 0],
            [100, 0],
            [0, 100],
            [-100, 0],
            [0, -100],
          ],
        ],
      };

      const result = parseTopoJSON(topojson, 'topo_test');
      expect(result.featureCount).toBe(1);
      expect(result.features[0]!.id).toBe('zone_a');
      expect(result.features[0]!.geometry?.type).toBe('Polygon');
      expect(result.facts.length).toBe(1); // score: 98
    });
  });

  describe('Gazetteer & Ambiguous Place Names (PRD Gate)', () => {
    it('resolves unique state and district names cleanly', () => {
      const resMh = lookupPlace('Maharashtra');
      expect(resMh.status).toBe('exact');
      expect(resMh.entry?.id).toBe('IN-MH');

      const resBlr = lookupPlace('Bangalore');
      expect(resBlr.status).toBe('exact');
      expect(resBlr.entry?.id).toBe('IN-KA-BLR');
    });

    it('FLAGS ambiguous place names instead of guessing when no context is provided', () => {
      // Bilaspur exists in both Chhattisgarh (IN-CT-BIL) and Himachal Pradesh (IN-HP-BIL)
      const res = lookupPlace('Bilaspur');
      expect(res.status).toBe('ambiguous');
      expect(res.candidates).toBeDefined();
      expect(res.candidates?.length).toBe(2);
      const parentCodes = res.candidates?.map((c) => c.parentCode);
      expect(parentCodes).toContain('IN-CT');
      expect(parentCodes).toContain('IN-HP');

      // Pratapgarh exists in Rajasthan and Uttar Pradesh
      const resPra = lookupPlace('Pratapgarh');
      expect(resPra.status).toBe('ambiguous');
      expect(resPra.candidates?.length).toBe(2);
    });

    it('disambiguates place names when parent state context is provided', () => {
      const resDisambiguated = lookupPlace('Bilaspur', { stateCode: 'IN-CT' });
      expect(resDisambiguated.status).toBe('exact');
      expect(resDisambiguated.entry?.id).toBe('IN-CT-BIL');
      expect(resDisambiguated.entry?.parentCode).toBe('IN-CT');
    });

    it('flags ambiguous place records across dataset records', () => {
      const records = [
        { id: '1', name: 'Pune', value: 100 },
        { id: '2', name: 'Bilaspur', value: 200 }, // Ambiguous!
        { id: '3', name: 'Chennai', value: 300 },
      ];

      const disambig = disambiguatePlaceRecords(records);
      expect(disambig.matched.length).toBe(2);
      expect(disambig.ambiguous.length).toBe(1);
      expect(disambig.ambiguous[0]!.name).toBe('Bilaspur');
      expect(disambig.ambiguous[0]!.candidates.length).toBe(2);
    });
  });

  describe('SVG Vector Path Projection (Zero External Tile Servers)', () => {
    it('projects polygon coordinates into an SVG viewBox path string', () => {
      const geom = {
        type: 'Polygon' as const,
        coordinates: [
          [
            [70.0, 10.0],
            [80.0, 10.0],
            [80.0, 20.0],
            [70.0, 20.0],
            [70.0, 10.0],
          ],
        ],
      };
      const bbox: [number, number, number, number] = [70.0, 10.0, 80.0, 20.0];

      const svgPath = projectCoordinatesToSVGPath(geom, bbox, 800, 500, 20);
      expect(svgPath).toContain('M ');
      expect(svgPath).toContain('L ');
      expect(svgPath).toContain('Z');
    });
  });

  describe('Zip Bomb & Shapefile Archive Security', () => {
    it('rejects zip bombs with excessive compression ratios', () => {
      const safe = validateArchiveSafety({
        fileNames: ['points.shp', 'points.dbf', 'points.prj'],
        compressedBytes: 1000,
        uncompressedBytes: 1000000, // 1000:1 ratio!
      });
      expect(safe.safe).toBe(false);
      expect(safe.error).toContain('Zip bomb detected');
    });

    it('rejects archives exceeding 50 MB uncompressed limit', () => {
      const safe = validateArchiveSafety({
        fileNames: ['layer.shp'],
        compressedBytes: 20 * 1024 * 1024,
        uncompressedBytes: 60 * 1024 * 1024,
      });
      expect(safe.safe).toBe(false);
      expect(safe.error).toContain('exceeds 50 MB limit');
    });

    it('requires the mandatory shapefile trio (.shp, .dbf, .prj)', () => {
      const valid = validateShapefileArchiveFiles(['data.shp', 'data.dbf', 'data.prj']);
      expect(valid.valid).toBe(true);

      const invalid = validateShapefileArchiveFiles(['data.shp', 'data.dbf']);
      expect(invalid.valid).toBe(false);
      expect(invalid.missing).toContain('.prj');
    });
  });

  describe('Attribution and Neutral Boundary Disclaimer', () => {
    it('provides mandatory neutral boundary disclaimer for all map footers', () => {
      expect(NEUTRAL_BOUNDARY_DISCLAIMER).toBeDefined();
      expect(NEUTRAL_BOUNDARY_DISCLAIMER.length).toBeGreaterThan(20);
      expect(NEUTRAL_BOUNDARY_DISCLAIMER).toContain('illustrative');
      expect(NEUTRAL_BOUNDARY_DISCLAIMER).toContain('legal status');
    });
  });
});
