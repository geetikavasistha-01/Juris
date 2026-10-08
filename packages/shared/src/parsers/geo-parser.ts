import { UPLOAD_LIMITS } from '../modality.js';

export interface GeoValidationResult {
  isValid: boolean;
  featureCount: number;
  geometryTypes: string[];
  numericProperties: string[];
  bbox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
}

export interface ValidateGeoJsonOptions {
  maxFeatures?: number;
}

interface GeoJsonFeature {
  type: string;
  id?: string | number;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: Record<string, unknown>;
}

export interface GeoJsonObject {
  type: string;
  features?: GeoJsonFeature[];
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: Record<string, unknown>;
}

/**
 * Parses raw KML XML into a standard GeoJSON FeatureCollection
 */
export function parseKmlToGeoJson(rawKml: string): GeoJsonObject {
  const placemarkRegex = /<Placemark[\s\S]*?<\/Placemark>/gi;
  const matches = rawKml.match(placemarkRegex) || [];
  const features: GeoJsonFeature[] = [];

  for (let i = 0; i < matches.length; i++) {
    const p = matches[i];
    const nameMatch = p.match(/<name>([\s\S]*?)<\/name>/i);
    const descMatch = p.match(/<description>([\s\S]*?)<\/description>/i);
    const name = nameMatch ? nameMatch[1].trim() : `Feature ${i + 1}`;
    const description = descMatch ? descMatch[1].trim() : '';

    const properties: Record<string, unknown> = {
      name,
      description,
    };

    // Extract ExtendedData Data / SimpleData
    const dataRegex =
      /<(?:Data|SimpleData)\s+name=["']([^"']+)["']>([\s\S]*?)<\/(?:Data|SimpleData)>/gi;
    let dMatch: RegExpExecArray | null;
    while ((dMatch = dataRegex.exec(p)) !== null) {
      const key = dMatch[1];
      const valStr = dMatch[2].replace(/<value>([\s\S]*?)<\/value>/i, '$1').trim();
      const numVal = Number(valStr);
      properties[key] = !Number.isNaN(numVal) && valStr !== '' ? numVal : valStr;
    }

    // Extract numbers from description
    const numInDesc = description.match(/[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g);
    if (numInDesc && numInDesc.length > 0 && typeof properties.value === 'undefined') {
      const parsedNum = Number.parseFloat(numInDesc[0]);
      if (!Number.isNaN(parsedNum)) {
        properties.value = parsedNum;
      }
    }

    // Check Point
    const pointMatch = p.match(
      /<Point[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Point>/i,
    );
    if (pointMatch) {
      const rawCoords = pointMatch[1].trim().split(/[\s,]+/);
      if (rawCoords.length >= 2) {
        const lon = Number.parseFloat(rawCoords[0]);
        const lat = Number.parseFloat(rawCoords[1]);
        if (!Number.isNaN(lon) && !Number.isNaN(lat)) {
          features.push({
            type: 'Feature',
            id: `kml-feature-${i + 1}`,
            geometry: {
              type: 'Point',
              coordinates: [lon, lat],
            },
            properties,
          });
          continue;
        }
      }
    }

    // Check Polygon
    const polyMatch = p.match(
      /<Polygon[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Polygon>/i,
    );
    if (polyMatch) {
      const coordTokens = polyMatch[1].trim().split(/\s+/);
      const ring: number[][] = [];
      for (const token of coordTokens) {
        const parts = token.split(',');
        if (parts.length >= 2) {
          const lon = Number.parseFloat(parts[0]);
          const lat = Number.parseFloat(parts[1]);
          if (!Number.isNaN(lon) && !Number.isNaN(lat)) {
            ring.push([lon, lat]);
          }
        }
      }
      if (ring.length >= 3) {
        features.push({
          type: 'Feature',
          id: `kml-feature-${i + 1}`,
          geometry: {
            type: 'Polygon',
            coordinates: [ring],
          },
          properties,
        });
        continue;
      }
    }

    // Check LineString
    const lineMatch = p.match(
      /<LineString[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/i,
    );
    if (lineMatch) {
      const coordTokens = lineMatch[1].trim().split(/\s+/);
      const line: number[][] = [];
      for (const token of coordTokens) {
        const parts = token.split(',');
        if (parts.length >= 2) {
          const lon = Number.parseFloat(parts[0]);
          const lat = Number.parseFloat(parts[1]);
          if (!Number.isNaN(lon) && !Number.isNaN(lat)) {
            line.push([lon, lat]);
          }
        }
      }
      if (line.length >= 2) {
        features.push({
          type: 'Feature',
          id: `kml-feature-${i + 1}`,
          geometry: {
            type: 'LineString',
            coordinates: line,
          },
          properties,
        });
        continue;
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Parses raw GeoJSON or KML into a standardized GeoJsonObject
 */
export function parseGeoFileToGeoJsonObject(rawContent: string): GeoJsonObject {
  const trimmed = rawContent.trim();
  if (
    trimmed.startsWith('<?xml') ||
    trimmed.startsWith('<kml') ||
    trimmed.includes('<kml') ||
    trimmed.includes('<Placemark')
  ) {
    return parseKmlToGeoJson(rawContent);
  }

  try {
    return JSON.parse(rawContent) as GeoJsonObject;
  } catch {
    const err = new Error('INVALID_GEOMETRY: Invalid JSON or KML spatial format.');
    (err as unknown as { code: string }).code = 'INVALID_GEOMETRY';
    throw err;
  }
}

/**
 * Validates GeoJSON / KML payload adhering to RFC 7946 and checks feature bounds
 */
export function validateGeoJson(
  rawGeoContent: string,
  options: ValidateGeoJsonOptions = {},
): GeoValidationResult {
  const maxFeatures = options.maxFeatures ?? UPLOAD_LIMITS.maxGeoFeatures;
  const parsed = parseGeoFileToGeoJsonObject(rawGeoContent);

  if (!parsed || typeof parsed !== 'object' || !parsed.type) {
    const err = new Error('INVALID_GEOMETRY: Missing required "type" field in GeoJSON/KML.');
    (err as unknown as { code: string }).code = 'INVALID_GEOMETRY';
    throw err;
  }

  const validTypes = [
    'FeatureCollection',
    'Feature',
    'Polygon',
    'MultiPolygon',
    'Point',
    'MultiPoint',
    'LineString',
    'MultiLineString',
  ];
  if (!validTypes.includes(parsed.type)) {
    const err = new Error(`INVALID_GEOMETRY: Unsupported GeoJSON type "${parsed.type}".`);
    (err as unknown as { code: string }).code = 'INVALID_GEOMETRY';
    throw err;
  }

  const features: GeoJsonFeature[] =
    parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)
      ? parsed.features
      : parsed.type === 'Feature'
        ? [parsed]
        : [];

  if (features.length > maxFeatures) {
    const err = new Error(
      `GEO_FEATURE_LIMIT_EXCEEDED: Feature count ${features.length} exceeds maximum limit of ${maxFeatures}.`,
    );
    (err as unknown as { code: string }).code = 'GEO_FEATURE_LIMIT_EXCEEDED';
    throw err;
  }

  const geometryTypesSet = new Set<string>();
  const numericPropertiesSet = new Set<string>();

  for (const feature of features) {
    if (feature.geometry?.type) {
      geometryTypesSet.add(feature.geometry.type);
    }
    if (feature.properties && typeof feature.properties === 'object') {
      for (const [k, v] of Object.entries(feature.properties)) {
        if (typeof v === 'number') {
          numericPropertiesSet.add(k);
        }
      }
    }
  }

  return {
    isValid: true,
    featureCount: features.length,
    geometryTypes: Array.from(geometryTypesSet),
    numericProperties: Array.from(numericPropertiesSet),
  };
}
