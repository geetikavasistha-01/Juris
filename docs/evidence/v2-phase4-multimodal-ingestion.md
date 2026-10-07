# Evidence: Juris v2 Phase 4 — Multimodal Ingestion Pipeline (CSV, GeoJSON, OCR)

**Date**: 2026-10-08  
**Phase**: Phase 4 — Multimodal Ingestion Pipeline (CSV Tabular Import, GeoJSON Spatial Parsing, Image/OCR Dimension Guards, Deterministic Tabular Query Engine)  
**Status**: Gate Passed ✅

---

## 1. Summary of Changes

1. **`packages/shared/src/modality.ts`**:
   - Defined `UploadLimitsSchema`, `QueryFilterSchema`, `QueryAggregateSchema`, `QueryPlanSchema`, and `QueryExecutionResultSchema`.
   - Exported constants for upload boundaries (`UPLOAD_LIMITS`).
2. **`packages/shared/src/parsers/csv-parser.ts`**:
   - Implemented `parseCsvTable()` and `inferColumnType()`.
   - Supports type inference for `number`, `currency`, `percentage`, `date`, and `string`.
   - Enforces configurable row and column limits (`TABLE_LIMIT_EXCEEDED`).
3. **`packages/shared/src/parsers/geo-parser.ts`**:
   - Implemented `validateGeoJson()` adhering to RFC 7946 GeoJSON specification.
   - Extracts geometry types, numeric properties, and checks feature limits (`GEO_FEATURE_LIMIT_EXCEEDED`).
4. **`packages/shared/src/parsers/image-validator.ts`**:
   - Implemented `validateImageDimensions()` with dimension extraction without full image decoding to prevent image bomb attacks (`IMAGE_DIMENSIONS_EXCEEDED`).
5. **`packages/shared/src/parsers/query-engine.ts`**:
   - Implemented deterministic in-memory `executeQueryPlanOnTable()`.
   - Supports filter operations (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `in`), groupings, aggregations (`sum`, `avg`, `min`, `max`, `count`), ordering, and limits.
6. **`packages/shared/src/parsers/multimodal.test.ts`**:
   - 9 unit tests verifying CSV parsing, column inference, GeoJSON validation, image dimension bounds, and table query execution.
7. **`apps/api/src/pipeline/ingestion.ts`**:
   - Extended `runDocumentIngestionPipeline()` with multimodal routing:
     - **Branch A (CSV Tabular)**: Parses CSV, inserts `sources` record (`modality: 'tabular'`), generates column metadata in `datasets`, populates `tables`, computes deterministic aggregate facts (`proof_type: 'computed_from_table'`), creates `table_cell` evidence spans, and constructs key figures visual configs.
     - **Branch B (GeoJSON Spatial)**: Validates GeoJSON, inserts `sources` record (`modality: 'spatial'`), populates `geo_layers`, creates spatial facts (`proof_type: 'geo_parsed'`), generates `geo_feature` evidence spans, and constructs choropleth map visual specs.
     - **Branch C (PDF Document)**: Retains verified text extraction and mechanical quotation verification (`proof_type: 'verified'`).
8. **`apps/api/src/routes/documents.ts`**:
   - Updated multipart upload handler to accept `.pdf`, `.csv`, `.geojson` formats.
   - Enhanced `resolveAuthUser` with retry logic for resilient token resolution.
9. **`supabase/migrations/20261008000001_v2_evidence_graph.sql`**:
   - Updated RLS policies across v2 tables to enable authenticated document owners to manage records (`FOR ALL TO authenticated`) while enforcing strict tenant boundaries.
10. **`apps/api/src/documents.test.ts`**:
    - Added comprehensive integration tests verifying end-to-end upload and pipeline execution for CSV tabular and GeoJSON spatial datasets.

---

## 2. Verification Commands & Observed Results

### A. Unit & Integration Verification Suite

```bash
pnpm test
```

**Output**:

- 16 test files passed (16/16)
- 111 tests passed (111/111), including all `multimodal.test.ts` and `documents.test.ts` integration tests.

### B. Fixture & Quality Guards

```bash
pnpm run check:fixtures && pnpm run check:tokens && pnpm run check:contrast && pnpm run check:external-hosts && pnpm run check:forbidden && pnpm run check:requirements && pnpm run check:visual-specs && pnpm run scan:secrets && pnpm typecheck && pnpm lint && pnpm check:bundle
```

**Output**:

- `check:fixtures`: Passed.
- `check:tokens`: 100% token compliant.
- `check:contrast`: All 60 color pairs pass WCAG AA (ΔE_00 >= 10.0 and contrast >= 4.5:1).
- `check:external-hosts`: Zero external CDN dependencies; all assets self-hosted.
- `check:forbidden`: 0 forbidden terms found across 66 product files.
- `check:requirements`: All 34 requirements validated.
- `check:visual-specs`: 100% point-to-fact provenance verified.
- `scan:secrets`: 0 leaks found (clean).
- `typecheck`: Passed with 0 errors across 5 workspace projects.
- `lint`: Passed.
- `check:bundle`: Initial JS Gzip: 210.26 KB (budget: 300 KB).

### C. Playwright End-to-End Suite

```bash
pnpm run e2e e2e/ui-states/
pnpm run e2e e2e/real/ --workers=1
```

**Output**:

- `e2e/ui-states/`: 7/7 tests passed (dropzone, keyboard trapping, guest access, focus restoration).
- `e2e/real/`: 16/16 tests passed (Axe WCAG AA scans across light/dark/mobile/desktop, isolation tests, multi-page worker ingestion).

---

## 3. Side Effects

- **Files Created**:
  - `packages/shared/src/parsers/csv-parser.ts`
  - `packages/shared/src/parsers/geo-parser.ts`
  - `packages/shared/src/parsers/image-validator.ts`
  - `packages/shared/src/parsers/query-engine.ts`
  - `packages/shared/src/parsers/index.ts`
  - `packages/shared/src/parsers/multimodal.test.ts`
  - `docs/evidence/v2-phase4-multimodal-ingestion.md`
- **Files Modified**:
  - `packages/shared/src/modality.ts`
  - `packages/shared/src/index.ts`
  - `apps/api/src/routes/documents.ts`
  - `apps/api/src/pipeline/ingestion.ts`
  - `apps/api/src/documents.test.ts`
  - `supabase/migrations/20261008000001_v2_evidence_graph.sql`
- **Side effects**:
  - Applied RLS update in local Supabase Docker database for v2 tables (`sources`, `datasets`, `geo_layers`, etc.).
  - No new external packages installed.

---

## 4. Not Verified / Human Review Items

- Manual human verification of custom OCR models on scanned archival paper (mock-free deterministic parsers and validators verified in CI).
- Review queue UI approval flows remain strictly human-operated per Rule 8 of `AGENTS.md`.
