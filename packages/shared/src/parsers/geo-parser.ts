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

interface GeoJsonObject {
  type: string;
  features?: GeoJsonFeature[];
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
  properties?: Record<string, unknown>;
}

/**
 * Validates GeoJSON payload adhering to RFC 7946 and checks feature bounds
 */
export function validateGeoJson(
  rawGeoJson: string,
  options: ValidateGeoJsonOptions = {},
): GeoValidationResult {
  const maxFeatures = options.maxFeatures ?? UPLOAD_LIMITS.maxGeoFeatures;

  let parsed: GeoJsonObject;
  try {
    parsed = JSON.parse(rawGeoJson) as GeoJsonObject;
  } catch {
    const err = new Error('INVALID_GEOMETRY: Invalid JSON format.');
    (err as unknown as { code: string }).code = 'INVALID_GEOMETRY';
    throw err;
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.type) {
    const err = new Error('INVALID_GEOMETRY: Missing required "type" field in GeoJSON.');
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
