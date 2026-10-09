/**
 * @juris/geodata
 * Bundled offline gazetteer and boundary geometries for Juris.
 * Total size strictly under 3 MB, lazy-loadable, zero external tile server dependencies.
 */

export type GazetteerLevel = 'country' | 'state' | 'district';

export interface GazetteerEntry {
  id: string;
  name: string;
  level: GazetteerLevel;
  countryCode: string;
  parentCode?: string;
  aliases: string[];
  centroid: [number, number]; // [lng, lat]
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  /** Simplified polygon coordinates: array of rings [[lng, lat], ...] */
  coordinates?: [number, number][][];
}

export interface GazetteerMatchResult {
  status: 'exact' | 'ambiguous' | 'not_found';
  entry?: GazetteerEntry;
  candidates?: GazetteerEntry[];
  query: string;
}

export const NEUTRAL_BOUNDARY_DISCLAIMER =
  'Juris boundary representations are illustrative for data visualization purposes and do not imply the expression of any opinion whatsoever concerning the legal status of any country, territory, city, or area or of its authorities.';

export const GEODATA_ATTRIBUTION =
  'Boundary reference geometries simplified from Natural Earth (Public Domain) and Open Government Data cartographic reference benchmarks.';

// Core gazetteer dictionary with countries, states/UTs, and districts
export const GAZETTEER_ENTRIES: GazetteerEntry[] = [
  // --- Countries ---
  {
    id: 'IND',
    name: 'India',
    level: 'country',
    countryCode: 'IND',
    aliases: ['in', 'bharat', 'republic of india'],
    centroid: [78.9629, 20.5937],
    bbox: [68.1, 8.0, 97.4, 37.1],
    coordinates: [
      [
        [74.0, 35.0],
        [77.0, 35.5],
        [80.0, 31.0],
        [88.0, 27.5],
        [97.0, 28.0],
        [95.0, 24.0],
        [92.0, 21.0],
        [88.0, 21.5],
        [80.0, 13.0],
        [77.5, 8.1],
        [72.5, 19.0],
        [69.0, 23.0],
        [71.0, 28.0],
        [74.0, 35.0],
      ],
    ],
  },
  {
    id: 'USA',
    name: 'United States',
    level: 'country',
    countryCode: 'USA',
    aliases: ['us', 'usa', 'united states of america'],
    centroid: [-98.5795, 39.8283],
    bbox: [-125.0, 24.5, -66.9, 49.4],
    coordinates: [
      [
        [-124.7, 48.4],
        [-67.0, 47.0],
        [-71.0, 42.0],
        [-75.0, 35.0],
        [-80.5, 25.0],
        [-97.0, 26.0],
        [-117.0, 32.5],
        [-124.7, 48.4],
      ],
    ],
  },
  {
    id: 'GBR',
    name: 'United Kingdom',
    level: 'country',
    countryCode: 'GBR',
    aliases: ['uk', 'great britain', 'britain'],
    centroid: [-3.436, 55.3781],
    bbox: [-8.65, 49.86, 1.77, 60.86],
  },

  // --- Indian States & UTs ---
  {
    id: 'IN-DL',
    name: 'Delhi',
    level: 'state',
    countryCode: 'IND',
    parentCode: 'IND',
    aliases: ['nct of delhi', 'national capital territory of delhi', 'new delhi'],
    centroid: [77.1025, 28.7041],
    bbox: [76.84, 28.4, 77.35, 28.88],
    coordinates: [
      [
        [76.84, 28.5],
        [77.1, 28.88],
        [77.35, 28.65],
        [77.2, 28.4],
        [76.84, 28.5],
      ],
    ],
  },
  {
    id: 'IN-MH',
    name: 'Maharashtra',
    level: 'state',
    countryCode: 'IND',
    parentCode: 'IND',
    aliases: ['mh', 'state of maharashtra'],
    centroid: [75.7139, 19.7515],
    bbox: [72.6, 15.6, 80.9, 22.0],
    coordinates: [
      [
        [72.6, 19.0],
        [74.0, 21.5],
        [79.0, 21.5],
        [80.9, 19.0],
        [76.0, 16.0],
        [73.5, 15.6],
        [72.6, 19.0],
      ],
    ],
  },
  {
    id: 'IN-KA',
    name: 'Karnataka',
    level: 'state',
    countryCode: 'IND',
    parentCode: 'IND',
    aliases: ['ka', 'state of karnataka'],
    centroid: [75.7382, 15.3173],
    bbox: [74.05, 11.59, 78.59, 18.45],
    coordinates: [
      [
        [74.1, 14.5],
        [75.5, 18.45],
        [77.5, 18.0],
        [78.5, 13.5],
        [76.5, 11.6],
        [74.8, 12.8],
        [74.1, 14.5],
      ],
    ],
  },
  {
    id: 'IN-TN',
    name: 'Tamil Nadu',
    level: 'state',
    countryCode: 'IND',
    parentCode: 'IND',
    aliases: ['tn', 'state of tamil nadu'],
    centroid: [78.6569, 11.1271],
    bbox: [76.24, 8.08, 80.35, 13.57],
    coordinates: [
      [
        [76.3, 11.5],
        [79.5, 13.5],
        [80.3, 13.0],
        [79.0, 9.2],
        [77.5, 8.1],
        [77.2, 10.0],
        [76.3, 11.5],
      ],
    ],
  },
  {
    id: 'IN-UP',
    name: 'Uttar Pradesh',
    level: 'state',
    countryCode: 'IND',
    parentCode: 'IND',
    aliases: ['up', 'state of uttar pradesh'],
    centroid: [80.3297, 26.8467],
    bbox: [77.08, 23.87, 84.64, 30.41],
    coordinates: [
      [
        [77.1, 29.5],
        [78.5, 30.4],
        [84.6, 26.5],
        [83.0, 24.0],
        [79.0, 24.5],
        [77.5, 27.5],
        [77.1, 29.5],
      ],
    ],
  },
  {
    id: 'IN-GJ',
    name: 'Gujarat',
    level: 'state',
    countryCode: 'IND',
    parentCode: 'IND',
    aliases: ['gj', 'state of gujarat'],
    centroid: [71.1924, 22.2587],
    bbox: [68.1, 20.1, 74.5, 24.7],
    coordinates: [
      [
        [68.8, 23.5],
        [72.0, 24.7],
        [74.5, 22.0],
        [73.0, 20.1],
        [70.0, 20.8],
        [69.0, 22.5],
        [68.8, 23.5],
      ],
    ],
  },
  {
    id: 'IN-WB',
    name: 'West Bengal',
    level: 'state',
    countryCode: 'IND',
    parentCode: 'IND',
    aliases: ['wb', 'state of west bengal'],
    centroid: [87.855, 22.9868],
    bbox: [85.8, 21.5, 89.9, 27.2],
    coordinates: [
      [
        [88.0, 27.2],
        [89.8, 26.5],
        [88.5, 24.0],
        [88.8, 21.6],
        [86.8, 22.0],
        [86.5, 24.0],
        [88.0, 27.2],
      ],
    ],
  },
  {
    id: 'IN-TG',
    name: 'Telangana',
    level: 'state',
    countryCode: 'IND',
    parentCode: 'IND',
    aliases: ['ts', 'state of telangana'],
    centroid: [79.0193, 18.1124],
    bbox: [77.2, 15.8, 81.3, 19.9],
  },
  {
    id: 'IN-KL',
    name: 'Kerala',
    level: 'state',
    countryCode: 'IND',
    parentCode: 'IND',
    aliases: ['kl', 'state of kerala'],
    centroid: [76.2711, 10.8505],
    bbox: [74.8, 8.3, 77.4, 12.8],
  },
  {
    id: 'IN-RJ',
    name: 'Rajasthan',
    level: 'state',
    countryCode: 'IND',
    parentCode: 'IND',
    aliases: ['rj', 'state of rajasthan'],
    centroid: [74.2179, 27.0238],
    bbox: [69.5, 23.0, 78.3, 30.2],
  },
  {
    id: 'IN-BR',
    name: 'Bihar',
    level: 'state',
    countryCode: 'IND',
    parentCode: 'IND',
    aliases: ['br', 'state of bihar'],
    centroid: [85.3131, 25.0961],
    bbox: [83.3, 24.3, 88.3, 27.5],
  },
  {
    id: 'IN-MP',
    name: 'Madhya Pradesh',
    level: 'state',
    countryCode: 'IND',
    parentCode: 'IND',
    aliases: ['mp', 'state of madhya pradesh'],
    centroid: [77.947, 23.4733],
    bbox: [74.0, 21.0, 82.8, 26.9],
  },
  {
    id: 'IN-CT',
    name: 'Chhattisgarh',
    level: 'state',
    countryCode: 'IND',
    parentCode: 'IND',
    aliases: ['cg', 'state of chhattisgarh'],
    centroid: [81.8661, 21.2787],
    bbox: [80.2, 17.8, 84.4, 24.1],
  },
  {
    id: 'IN-HP',
    name: 'Himachal Pradesh',
    level: 'state',
    countryCode: 'IND',
    parentCode: 'IND',
    aliases: ['hp', 'state of himachal pradesh'],
    centroid: [77.1734, 31.1048],
    bbox: [75.6, 30.4, 79.0, 33.3],
  },

  // --- Indian Districts ---
  {
    id: 'IN-MH-MUM',
    name: 'Mumbai',
    level: 'district',
    countryCode: 'IND',
    parentCode: 'IN-MH',
    aliases: ['mumbai city', 'bombay', 'mumbai suburban'],
    centroid: [72.8777, 19.076],
    bbox: [72.77, 18.89, 72.98, 19.27],
  },
  {
    id: 'IN-KA-BLR',
    name: 'Bengaluru Urban',
    level: 'district',
    countryCode: 'IND',
    parentCode: 'IN-KA',
    aliases: ['bengaluru', 'bangalore', 'bangalore urban', 'bengaluru city'],
    centroid: [77.5946, 12.9716],
    bbox: [77.38, 12.73, 77.78, 13.14],
  },
  {
    id: 'IN-MH-PUN',
    name: 'Pune',
    level: 'district',
    countryCode: 'IND',
    parentCode: 'IN-MH',
    aliases: ['poona', 'pune district'],
    centroid: [73.8567, 18.5204],
    bbox: [73.3, 17.9, 75.2, 19.4],
  },
  {
    id: 'IN-TN-CHE',
    name: 'Chennai',
    level: 'district',
    countryCode: 'IND',
    parentCode: 'IN-TN',
    aliases: ['madras', 'chennai district'],
    centroid: [80.2707, 13.0827],
    bbox: [80.12, 12.87, 80.33, 13.23],
  },
  {
    id: 'IN-WB-KOL',
    name: 'Kolkata',
    level: 'district',
    countryCode: 'IND',
    parentCode: 'IN-WB',
    aliases: ['calcutta', 'kolkata district'],
    centroid: [88.3639, 22.5726],
    bbox: [88.25, 22.45, 88.45, 22.65],
  },
  {
    id: 'IN-TG-HYD',
    name: 'Hyderabad',
    level: 'district',
    countryCode: 'IND',
    parentCode: 'IN-TG',
    aliases: ['hyderabad district', 'hyderabad city'],
    centroid: [78.4867, 17.385],
    bbox: [78.35, 17.28, 78.6, 17.55],
  },
  {
    id: 'IN-GJ-AHM',
    name: 'Ahmedabad',
    level: 'district',
    countryCode: 'IND',
    parentCode: 'IN-GJ',
    aliases: ['ahmedabad district', 'amdavad'],
    centroid: [72.5714, 23.0225],
    bbox: [71.8, 22.3, 73.0, 23.6],
  },

  // --- Real Ambiguous Places (Must be flagged, not guessed!) ---
  // Bilaspur exists in Chhattisgarh AND Himachal Pradesh
  {
    id: 'IN-CT-BIL',
    name: 'Bilaspur',
    level: 'district',
    countryCode: 'IND',
    parentCode: 'IN-CT',
    aliases: ['bilaspur district, chhattisgarh', 'bilaspur cg'],
    centroid: [82.1409, 22.0797],
    bbox: [81.8, 21.7, 82.5, 22.5],
  },
  {
    id: 'IN-HP-BIL',
    name: 'Bilaspur',
    level: 'district',
    countryCode: 'IND',
    parentCode: 'IN-HP',
    aliases: ['bilaspur district, himachal', 'bilaspur hp'],
    centroid: [76.7567, 31.3326],
    bbox: [76.4, 31.1, 77.0, 31.6],
  },
  // Pratapgarh exists in Rajasthan AND Uttar Pradesh
  {
    id: 'IN-RJ-PRA',
    name: 'Pratapgarh',
    level: 'district',
    countryCode: 'IND',
    parentCode: 'IN-RJ',
    aliases: ['pratapgarh district, rajasthan'],
    centroid: [74.7813, 24.0315],
    bbox: [74.5, 23.7, 75.1, 24.4],
  },
  {
    id: 'IN-UP-PRA',
    name: 'Pratapgarh',
    level: 'district',
    countryCode: 'IND',
    parentCode: 'IN-UP',
    aliases: ['pratapgarh district, uttar pradesh'],
    centroid: [81.9868, 25.9259],
    bbox: [81.5, 25.6, 82.4, 26.2],
  },
];

/**
 * Normalizes place query strings for lookup.
 */
export function normalizePlaceQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .replace(/\b(state of|district of|district|nct of|state|ut of|union territory of)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Look up a place name in the bundled offline gazetteer.
 * Disambiguates by parent code (e.g. stateCode) if provided.
 * Flagged as 'ambiguous' if multiple records match and no parent context resolves it.
 */
export function lookupPlace(
  rawName: string,
  context?: { countryCode?: string; stateCode?: string },
): GazetteerMatchResult {
  const query = normalizePlaceQuery(rawName);
  if (!query) {
    return { status: 'not_found', query: rawName };
  }

  // Find all candidate matches
  const matches = GAZETTEER_ENTRIES.filter((entry) => {
    const normName = normalizePlaceQuery(entry.name);
    if (normName === query) return true;
    return entry.aliases.some((alias) => normalizePlaceQuery(alias) === query);
  });

  if (matches.length === 0) {
    return { status: 'not_found', query: rawName };
  }

  // If context is provided, narrow down candidates
  let filtered = matches;
  if (context?.stateCode) {
    const parentMatches = filtered.filter(
      (m) => m.parentCode === context.stateCode || m.id === context.stateCode,
    );
    if (parentMatches.length > 0) {
      filtered = parentMatches;
    }
  }
  if (context?.countryCode) {
    const countryMatches = filtered.filter((m) => m.countryCode === context.countryCode);
    if (countryMatches.length > 0) {
      filtered = countryMatches;
    }
  }

  if (filtered.length === 1) {
    return { status: 'exact', entry: filtered[0], query: rawName };
  }

  // Multiple candidates remain -> Flag as ambiguous rather than guessing!
  return {
    status: 'ambiguous',
    candidates: filtered,
    query: rawName,
  };
}

/**
 * Returns all boundary entries, optionally filtered by administrative level.
 */
export function getAllBoundaries(level?: GazetteerLevel): GazetteerEntry[] {
  if (!level) return GAZETTEER_ENTRIES;
  return GAZETTEER_ENTRIES.filter((e) => e.level === level);
}

/**
 * Retrieves a boundary entry by exact gazetteer ID.
 */
export function getBoundaryById(id: string): GazetteerEntry | undefined {
  return GAZETTEER_ENTRIES.find((e) => e.id.toUpperCase() === id.toUpperCase());
}
