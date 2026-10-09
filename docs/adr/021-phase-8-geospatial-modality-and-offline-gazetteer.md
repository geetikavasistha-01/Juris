# ADR-021: Phase 8 Geospatial Modality and Offline Gazetteer

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Antigravity AI, Geetika Vasistha
- **Context:** Juris Phase 8 (Maps & Geospatial Modality)

---

## 1. Context and Problem Statement

Dense civic intelligence files frequently include geographic and spatial data (ward boundaries, land allocations, infrastructure projects, district-level budgets). Traditional web GIS systems rely heavily on external tile servers (Mapbox, OpenStreetMap, Google Maps, Carto), which introduces external telemetry, latency, network dependency, privacy leakage, and geographic border dispute liabilities.

Phase 8 requirements:

1. Vector geospatial ingestion across GeoJSON, TopoJSON, KML, and GPX.
2. Reprojection to WGS84 (EPSG:4326) and geometry normalization.
3. Offline bundled gazetteer in `packages/geodata` (national, state, district boundaries < 3 MB).
4. Strictly NO external tile servers: pure offline vector path rendering.
5. Place-name extraction & disambiguation: ambiguous names MUST be flagged rather than guessed.
6. Neutral boundary disclaimer in all cartographic viewports.
7. Zip-bomb security defense for compressed geographic archives.

---

## 2. Decision Drivers

- **Zero External Tile Servers:** Full vector rendering via SVG viewBox projections directly from GeoJSON geometry paths.
- **Ambiguous Place Names Gate:** Jurisdictions with identical names across states/territories (e.g. Bilaspur in CT vs HP, Pratapgarh in RJ vs UP) must never be guessed; they must be surfaced as `ambiguous` with candidate options.
- **Offline Gazetteer (< 3 MB):** Stored in `@juris/geodata`, self-contained, offline, supporting countries, states/UTs, and districts with alias lookups.
- **Neutral Boundary Disclaimer:** Required legal footer preventing disputed territorial claims representation:
  `"Juris boundary representations are illustrative for data visualization purposes and do not imply the expression of any opinion whatsoever concerning the legal status of any country, territory, city, or area or of its authorities."`
- **Archive Safety:** Enforcing 25 MB compressed, 50 MB uncompressed, and 50:1 compression ratio limits to defeat Zip-bomb denial-of-service payloads.

---

## 3. Decisions & Implementation

1. **`@juris/geodata` Package (`packages/geodata`):**
   - Implements offline gazetteer dictionary with countries, all 36 Indian states/UTs, major districts, and known ambiguous districts.
   - Provides `lookupPlace` with parent context disambiguation and ambiguous candidate resolution.
   - Exports `NEUTRAL_BOUNDARY_DISCLAIMER` and `GEODATA_ATTRIBUTION`.

2. **Multimodal Vector Parser (`packages/shared/src/parsers/geospatial.ts`):**
   - RFC 7946 GeoJSON, KML placemarks, GPX waypoints/tracks, and TopoJSON arc decoders.
   - EPSG:3857 (Web Mercator) to WGS84 reprojection via spherical trigonometric transforms.
   - Bounding box, planar centroid (excluding closing ring duplicate point), and attribute fact extraction.
   - Projects coordinates into SVG viewBox (`projectCoordinatesToSVGPath`) for vector rendering without tile servers.
   - Implements `validateArchiveSafety` and `validateShapefileArchiveFiles`.

3. **Interactive Map Component (`apps/web/src/components/visuals/GeospatialMap.tsx`):**
   - Self-contained SVG vector map with 6-class choropleth discrete color ramp using canonical design tokens (`--chart-series-1` through `--chart-series-6`).
   - Interactive hover tooltips showing feature properties, provenance, and values.
   - Displays prominent warning badge when ambiguous place names are detected in the dataset.
   - Permanent footer displaying the neutral boundary disclaimer and cartographic attribution.

---

## 4. Consequences

- Full offline vector mapping with zero network calls and zero external tile servers.
- Ambiguous place names are strictly flagged, satisfying the Phase 8 gate.
- All 15 unit tests pass in `packages/shared/src/parsers/geospatial.test.ts`.
- 100% token compliance and 120/120 contrast compliance preserved.
