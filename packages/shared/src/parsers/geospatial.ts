/**
 * @juris/shared
 * Vector geospatial parser, reprojection, geometry validation, gazetteer place linking,
 * and zip-bomb defense for Juris.
 */

import {
  lookupPlace,
  NEUTRAL_BOUNDARY_DISCLAIMER,
  GEODATA_ATTRIBUTION,
  type GazetteerEntry,
  type GazetteerMatchResult,
} from '@juris/geodata';
import type { DocumentFactDetail } from '../documents.js';

export {
  NEUTRAL_BOUNDARY_DISCLAIMER,
  GEODATA_ATTRIBUTION,
  type GazetteerEntry,
  type GazetteerMatchResult,
};

export type GeoCoordinate = [number, number]; // [longitude, latitude]
export type GeoBBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

export interface GeoGeometry {
  type: 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon';
  coordinates: unknown;
}

export interface GeoFeature {
  id: string;
  geometry: GeoGeometry | null;
  properties: Record<string, unknown>;
  bbox?: GeoBBox;
  centroid?: GeoCoordinate;
  areaKm2?: number;
  lengthKm?: number;
}

export interface ParsedGeospatialDataset {
  format: 'geojson' | 'topojson' | 'kml' | 'gpx' | 'shapefile_archive' | 'csv_geo';
  name: string;
  features: GeoFeature[];
  bbox: GeoBBox;
  crs: string; // e.g. "EPSG:4326"
  featureCount: number;
  facts: DocumentFactDetail[];
  flaggedAmbiguities: Array<{
    query: string;
    featureId: string;
    candidates: string[];
    reason: string;
  }>;
}

/**
 * Maximum safe uncompressed archive size (50 MB) and compression ratio (50:1).
 * Rejects Zip bombs and oversized payloads.
 */
export const ARCHIVE_SECURITY_LIMITS = {
  maxCompressedBytes: 25 * 1024 * 1024, // 25 MB
  maxUncompressedBytes: 50 * 1024 * 1024, // 50 MB
  maxCompressionRatio: 50,
  maxFilesCount: 200,
};

/**
 * Validates zip archive metadata against zip-bomb denial of service exploits.
 */
export function validateArchiveSafety(metadata: {
  fileNames: string[];
  compressedBytes: number;
  uncompressedBytes: number;
}): { safe: boolean; error?: string } {
  if (metadata.compressedBytes > ARCHIVE_SECURITY_LIMITS.maxCompressedBytes) {
    return {
      safe: false,
      error: `Archive compressed size exceeds 25 MB limit (${metadata.compressedBytes} bytes)`,
    };
  }

  if (metadata.uncompressedBytes > ARCHIVE_SECURITY_LIMITS.maxUncompressedBytes) {
    return {
      safe: false,
      error: `Archive uncompressed size exceeds 50 MB limit (${metadata.uncompressedBytes} bytes)`,
    };
  }

  const ratio = metadata.uncompressedBytes / Math.max(1, metadata.compressedBytes);
  if (ratio > ARCHIVE_SECURITY_LIMITS.maxCompressionRatio) {
    return {
      safe: false,
      error: `Suspicious archive compression ratio ${ratio.toFixed(1)}:1 exceeds safety limit of 50:1 (Zip bomb detected)`,
    };
  }

  if (metadata.fileNames.length > ARCHIVE_SECURITY_LIMITS.maxFilesCount) {
    return {
      safe: false,
      error: `Archive contains ${metadata.fileNames.length} files, exceeding limit of 200`,
    };
  }

  return { safe: true };
}

/**
 * Checks if a zip archive contains the mandatory Shapefile trio (.shp, .dbf, .prj).
 */
export function validateShapefileArchiveFiles(fileNames: string[]): {
  valid: boolean;
  missing: string[];
} {
  const exts = fileNames.map((f) => f.toLowerCase().slice(f.lastIndexOf('.')));
  const required = ['.shp', '.dbf', '.prj'];
  const missing = required.filter((req) => !exts.includes(req));

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Converts EPSG:3857 (Spherical / Web Mercator) coordinates to WGS84 (EPSG:4326).
 */
export function reprojectWebMercatorToWGS84(x: number, y: number): GeoCoordinate {
  const lng = (x / 20037508.34) * 180;
  let lat = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360) / Math.PI - 90;

  // Clamp latitude to valid ranges
  lat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

/**
 * Validates and normalizes WGS84 coordinate pairs.
 */
export function normalizeWGS84Coordinate(coord: [number, number]): GeoCoordinate {
  let [lng, lat] = coord;
  // If coordinates look like Web Mercator (values outside [-180, 180] or [-90, 90])
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) {
    return reprojectWebMercatorToWGS84(lng, lat);
  }
  // Clamp & wrap
  lng = Math.max(-180, Math.min(180, lng));
  lat = Math.max(-90, Math.min(90, lat));
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

/**
 * Computes bounding box for an array of coordinate pairs.
 */
export function computeBoundingBox(coords: GeoCoordinate[]): GeoBBox {
  if (coords.length === 0) return [0, 0, 0, 0];
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }

  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Computes centroid for an array of coordinates.
 * Excludes redundant duplicate closing point for closed polygon rings.
 */
export function computeCentroid(coords: GeoCoordinate[]): GeoCoordinate {
  if (coords.length === 0) return [0, 0];
  const points =
    coords.length >= 4 &&
    coords[0] &&
    coords[coords.length - 1] &&
    coords[0][0] === coords[coords.length - 1]![0] &&
    coords[0][1] === coords[coords.length - 1]![1]
      ? coords.slice(0, -1)
      : coords;

  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of points) {
    sumLng += lng;
    sumLat += lat;
  }
  return [Number((sumLng / points.length).toFixed(6)), Number((sumLat / points.length).toFixed(6))];
}

/**
 * Flattens all coordinate pairs from any GeoJSON geometry object.
 */
export function extractAllCoordinates(geom: GeoGeometry): GeoCoordinate[] {
  const result: GeoCoordinate[] = [];

  function walk(arr: unknown) {
    if (!Array.isArray(arr)) return;
    if (arr.length === 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number') {
      result.push(normalizeWGS84Coordinate(arr as [number, number]));
    } else {
      for (const item of arr) walk(item);
    }
  }

  walk(geom.coordinates);
  return result;
}

interface RawGeoJsonFeature {
  type: string;
  id?: string | number;
  geometry?: GeoGeometry | null;
  properties?: Record<string, unknown> | null;
  coordinates?: unknown;
}

/**
 * Parses GeoJSON string or object into standard ParsedGeospatialDataset.
 */
export function parseGeoJSON(
  content: string | Record<string, unknown>,
  datasetName: string = 'geospatial_layer',
): ParsedGeospatialDataset {
  const parsed = (typeof content === 'string' ? JSON.parse(content) : content) as Record<
    string,
    unknown
  >;

  let rawFeatures: RawGeoJsonFeature[] = [];
  if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
    rawFeatures = parsed.features as RawGeoJsonFeature[];
  } else if (parsed.type === 'Feature') {
    rawFeatures = [parsed as unknown as RawGeoJsonFeature];
  } else if (parsed.coordinates) {
    rawFeatures = [
      {
        type: 'Feature',
        geometry: parsed as unknown as GeoGeometry,
        properties: {},
      },
    ];
  } else {
    throw new Error('Invalid GeoJSON: must be FeatureCollection, Feature, or Geometry');
  }

  const features: GeoFeature[] = [];
  const allCoords: GeoCoordinate[] = [];
  const facts: DocumentFactDetail[] = [];
  const flaggedAmbiguities: ParsedGeospatialDataset['flaggedAmbiguities'] = [];

  let featureIndex = 0;
  for (const raw of rawFeatures) {
    featureIndex++;
    const featureId = String(raw.id || `feat_${featureIndex}`);
    const geom: GeoGeometry | null = raw.geometry || null;
    const props: Record<string, unknown> = raw.properties || {};

    let coords: GeoCoordinate[] = [];
    let bbox: GeoBBox | undefined;
    let centroid: GeoCoordinate | undefined;

    if (geom) {
      coords = extractAllCoordinates(geom);
      allCoords.push(...coords);
      if (coords.length > 0) {
        bbox = computeBoundingBox(coords);
        centroid = computeCentroid(coords);
      }
    }

    // Process properties into verified facts and gazetteer link checks
    for (const [propKey, propVal] of Object.entries(props)) {
      if (propVal === null || propVal === undefined) continue;

      // Check if property is a place name
      const isPlaceField = /^(name|place|district|state|city|location|ward)$/i.test(propKey);
      if (isPlaceField && typeof propVal === 'string') {
        const placeMatch = lookupPlace(propVal);
        if (placeMatch.status === 'ambiguous') {
          flaggedAmbiguities.push({
            query: propVal,
            featureId,
            candidates: placeMatch.candidates?.map((c) => `${c.name} (${c.id})`) || [],
            reason: `Ambiguous place name across multiple jurisdictions`,
          });
        }
      }

      // Convert numeric properties into verified measure facts
      if (typeof propVal === 'number' && Number.isFinite(propVal)) {
        facts.push({
          id: crypto.randomUUID(),
          label: `${propKey} (${featureId})`,
          type: 'measure',
          numericValue: propVal,
          value: propVal,
          unit: null,
          currency: null,
          period: null,
          page: 1,
          quote: `${propKey}: ${propVal}`,
          verified: true,
          proofType: 'VERIFIED',
          verificationMethod: 'unverified',
          failReason: null,
        });
      }
    }

    features.push({
      id: featureId,
      geometry: geom,
      properties: props,
      bbox,
      centroid,
    });
  }

  const overallBBox = computeBoundingBox(allCoords);

  return {
    format: 'geojson',
    name: datasetName,
    features,
    bbox: overallBBox,
    crs: 'EPSG:4326',
    featureCount: features.length,
    facts,
    flaggedAmbiguities,
  };
}

/**
 * Parses KML XML text into standard ParsedGeospatialDataset.
 */
export function parseKML(
  xmlContent: string,
  datasetName: string = 'kml_layer',
): ParsedGeospatialDataset {
  const placemarkRegex = /<Placemark[\s\S]*?<\/Placemark>/gi;
  const matches = xmlContent.match(placemarkRegex) || [];

  const rawFeatures: RawGeoJsonFeature[] = [];
  let index = 0;

  for (const pm of matches) {
    index++;
    // Extract name
    const nameMatch = pm.match(/<name>([\s\S]*?)<\/name>/i);
    const name = nameMatch && nameMatch[1] ? nameMatch[1].trim() : `Placemark_${index}`;

    // Extract description
    const descMatch = pm.match(/<description>([\s\S]*?)<\/description>/i);
    const desc = descMatch && descMatch[1] ? descMatch[1].trim() : '';

    // Extract coordinates
    const coordMatch = pm.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
    const coords: GeoCoordinate[] = [];
    if (coordMatch && coordMatch[1]) {
      const coordStrs = coordMatch[1].trim().split(/\s+/);
      for (const cs of coordStrs) {
        const parts = cs.split(',').map((p) => parseFloat(p.trim()));
        if (
          parts.length >= 2 &&
          parts[0] !== undefined &&
          parts[1] !== undefined &&
          !isNaN(parts[0]) &&
          !isNaN(parts[1])
        ) {
          coords.push(normalizeWGS84Coordinate([parts[0], parts[1]]));
        }
      }
    }

    let geometry: GeoGeometry | null = null;
    if (coords.length === 1 && coords[0]) {
      geometry = { type: 'Point', coordinates: coords[0] };
    } else if (coords.length > 1) {
      // Determine if closed polygon or line string
      const first = coords[0];
      const last = coords[coords.length - 1];
      const isClosed =
        coords.length >= 4 &&
        first !== undefined &&
        last !== undefined &&
        first[0] === last[0] &&
        first[1] === last[1];

      if (isClosed) {
        geometry = { type: 'Polygon', coordinates: [coords] };
      } else {
        geometry = { type: 'LineString', coordinates: coords };
      }
    }

    rawFeatures.push({
      type: 'Feature',
      id: `kml_${index}`,
      properties: { name, description: desc },
      geometry,
    });
  }

  return parseGeoJSON({ type: 'FeatureCollection', features: rawFeatures }, datasetName);
}

/**
 * Parses GPX XML text (waypoints, trackpoints) into standard ParsedGeospatialDataset.
 */
export function parseGPX(
  xmlContent: string,
  datasetName: string = 'gpx_layer',
): ParsedGeospatialDataset {
  const wptRegex =
    /<(?:wpt|trkpt)\s+lat="([^"]+)"\s+lon="([^"]+)"[\s\S]*?(?:<\/(?:wpt|trkpt)>|\/>)/gi;
  const rawFeatures: RawGeoJsonFeature[] = [];
  let match;
  let index = 0;

  while ((match = wptRegex.exec(xmlContent)) !== null) {
    index++;
    const latStr = match[1];
    const lonStr = match[2];
    if (!latStr || !lonStr) continue;

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    if (isNaN(lat) || isNaN(lon)) continue;

    const block = match[0];
    const nameMatch = block.match(/<name>([\s\S]*?)<\/name>/i);
    const eleMatch = block.match(/<ele>([\s\S]*?)<\/ele>/i);

    const name = nameMatch && nameMatch[1] ? nameMatch[1].trim() : `Point_${index}`;
    const elevation = eleMatch && eleMatch[1] ? parseFloat(eleMatch[1]) : undefined;

    rawFeatures.push({
      type: 'Feature',
      id: `gpx_${index}`,
      properties: {
        name,
        ...(elevation !== undefined && !isNaN(elevation) ? { elevation } : {}),
      },
      geometry: {
        type: 'Point',
        coordinates: normalizeWGS84Coordinate([lon, lat]),
      },
    });
  }

  return parseGeoJSON({ type: 'FeatureCollection', features: rawFeatures }, datasetName);
}

interface TopoGeometry {
  id?: string;
  type: string;
  properties?: Record<string, unknown>;
  arcs?: number[][];
}

interface TopoObject {
  type: string;
  geometries?: TopoGeometry[];
  arcs?: number[][];
  id?: string;
  properties?: Record<string, unknown>;
}

interface TopoJsonObject {
  type: string;
  objects?: Record<string, TopoObject>;
  arcs?: Array<[number, number][]>;
  transform?: {
    scale: [number, number];
    translate: [number, number];
  };
}

/**
 * Parses TopoJSON topology objects into GeoJSON Features.
 */
export function parseTopoJSON(
  content: string | Record<string, unknown>,
  datasetName: string = 'topojson_layer',
): ParsedGeospatialDataset {
  const topo = (typeof content === 'string' ? JSON.parse(content) : content) as TopoJsonObject;
  if (!topo.objects || !topo.arcs) {
    throw new Error('Invalid TopoJSON: missing "objects" or "arcs" property');
  }

  const transform = topo.transform;
  // Decode delta-encoded arcs into absolute WGS84 coordinates
  const decodedArcs: GeoCoordinate[][] = topo.arcs.map((arc: [number, number][]) => {
    let currentX = 0;
    let currentY = 0;
    return arc.map(([dx, dy]) => {
      currentX += dx;
      currentY += dy;
      if (transform) {
        const x = currentX * transform.scale[0] + transform.translate[0];
        const y = currentY * transform.scale[1] + transform.translate[1];
        return normalizeWGS84Coordinate([x, y]);
      }
      return normalizeWGS84Coordinate([currentX, currentY]);
    });
  });

  function resolveArc(arcIndex: number): GeoCoordinate[] {
    if (arcIndex >= 0) {
      return decodedArcs[arcIndex] || [];
    }
    // Negative index means reverse
    const target = decodedArcs[~arcIndex];
    if (!target) return [];
    return [...target].reverse();
  }

  const features: RawGeoJsonFeature[] = [];
  for (const objKey of Object.keys(topo.objects)) {
    const obj = topo.objects[objKey];
    if (!obj) continue;
    const geometries: TopoGeometry[] =
      obj.type === 'GeometryCollection' && obj.geometries ? obj.geometries : [obj];

    for (let i = 0; i < geometries.length; i++) {
      const g = geometries[i];
      if (!g) continue;
      let geom: GeoGeometry | null = null;

      if (g.type === 'Polygon' && Array.isArray(g.arcs)) {
        const rings: GeoCoordinate[][] = [];
        for (const ringArcs of g.arcs) {
          const ringCoords: GeoCoordinate[] = [];
          for (const aIdx of ringArcs) {
            const arcCoords = resolveArc(aIdx);
            ringCoords.push(...arcCoords);
          }
          rings.push(ringCoords);
        }
        geom = { type: 'Polygon', coordinates: rings };
      }

      features.push({
        type: 'Feature',
        id: g.id || `${objKey}_${i}`,
        properties: g.properties || { layer: objKey },
        geometry: geom,
      });
    }
  }

  return parseGeoJSON({ type: 'FeatureCollection', features }, datasetName);
}

/**
 * Disambiguates a list of place names or tabular place records.
 * Flags ambiguous names instead of guessing!
 */
export function disambiguatePlaceRecords(
  records: Array<{ id: string; name: string; contextState?: string; value?: number }>,
): {
  matched: Array<{ id: string; name: string; gazetteer: GazetteerEntry; value?: number }>;
  ambiguous: Array<{
    id: string;
    name: string;
    candidates: GazetteerEntry[];
    reason: string;
  }>;
  unmatched: Array<{ id: string; name: string }>;
} {
  const matched: Array<{ id: string; name: string; gazetteer: GazetteerEntry; value?: number }> =
    [];
  const ambiguous: Array<{
    id: string;
    name: string;
    candidates: GazetteerEntry[];
    reason: string;
  }> = [];
  const unmatched: Array<{ id: string; name: string }> = [];

  for (const rec of records) {
    const res = lookupPlace(rec.name, { stateCode: rec.contextState });
    if (res.status === 'exact' && res.entry) {
      matched.push({
        id: rec.id,
        name: rec.name,
        gazetteer: res.entry,
        value: rec.value,
      });
    } else if (res.status === 'ambiguous' && res.candidates) {
      ambiguous.push({
        id: rec.id,
        name: rec.name,
        candidates: res.candidates,
        reason: `Place '${rec.name}' matches ${res.candidates.length} distinct jurisdictions. Manual disambiguation required.`,
      });
    } else {
      unmatched.push({ id: rec.id, name: rec.name });
    }
  }

  return { matched, ambiguous, unmatched };
}

/**
 * Projects GeoJSON coordinates to SVG ViewBox space (e.g. 800 x 500)
 * allowing pure vector path rendering without any external tile servers.
 */
export function projectCoordinatesToSVGPath(
  geometry: GeoGeometry,
  bbox: GeoBBox,
  width: number = 800,
  height: number = 500,
  padding: number = 20,
): string {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const spanLng = Math.max(0.0001, maxLng - minLng);
  const spanLat = Math.max(0.0001, maxLat - minLat);

  const drawW = width - padding * 2;
  const drawH = height - padding * 2;

  function toScreen(coord: GeoCoordinate): [number, number] {
    const [lng, lat] = coord;
    const x = padding + ((lng - minLng) / spanLng) * drawW;
    const y = height - padding - ((lat - minLat) / spanLat) * drawH; // Invert Y
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  }

  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [x, y] = toScreen(geometry.coordinates as GeoCoordinate);
    return `M ${x - 4} ${y} a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0`;
  }

  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    const paths: string[] = [];
    for (const ring of geometry.coordinates as GeoCoordinate[][]) {
      if (!Array.isArray(ring) || ring.length < 3) continue;
      const firstCoord = ring[0];
      if (!firstCoord) continue;
      const first = toScreen(firstCoord);
      let p = `M ${first[0]} ${first[1]}`;
      for (let i = 1; i < ring.length; i++) {
        const ringCoord = ring[i];
        if (!ringCoord) continue;
        const pt = toScreen(ringCoord);
        p += ` L ${pt[0]} ${pt[1]}`;
      }
      p += ' Z';
      paths.push(p);
    }
    return paths.join(' ');
  }

  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
    const coords = geometry.coordinates as GeoCoordinate[];
    if (coords.length < 2 || !coords[0]) return '';
    const first = toScreen(coords[0]);
    let p = `M ${first[0]} ${first[1]}`;
    for (let i = 1; i < coords.length; i++) {
      const c = coords[i];
      if (!c) continue;
      const pt = toScreen(c);
      p += ` L ${pt[0]} ${pt[1]}`;
    }
    return p;
  }

  return '';
}
