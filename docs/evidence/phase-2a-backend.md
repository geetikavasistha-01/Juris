# Evidence: Phase 2a Backend & Worker Ingestion Engine (Walking Skeleton)

**Date**: 2026-10-06  
**Status**: VERIFIED  
**Branch**: `main`  
**Slice**: `phase-2a`

---

## 1. Scope & Objective

Implement the complete Phase 2a backend walking skeleton for **Juris**:

- **Contracts**: Typed Zod schemas for Document upload, detail, chunks, and monotonic job events in `@juris/shared`.
- **API Endpoints**:
  - `POST /api/documents`: Multipart upload, magic bytes (`%PDF-`) verification, 10MB limit enforcement, SHA-256 duplicate detection, background ingestion dispatch.
  - `GET /api/documents/:id`: Document metadata, analysis summary, key findings, and verified facts.
  - `GET /api/documents/:id/chunks`: Semantic chunk retrieval with optional full-text search match via Postgres RPC `match_chunks_fts`.
  - `GET /api/documents/:id/events`: Monotonic sequence event stream for polling recovery.
- **Worker Pipeline**:
  - 10-stage execution (`validating` → `extracting` → `chunking` → `embedding` → `classification` → `fact_extraction` → `verification` → `synthesis` → `building_visuals` → `done`).
  - Strict in-code fact verification with `verifyFactQuoteAndValue`.
  - Monotonic `job_events` insertion broadcasting via Supabase Realtime.

---

## 2. Commands Run & Observed Results

### A. Document API & Ingestion Pipeline Integration Test

```bash
$ npx vitest run apps/api/src/documents.test.ts
```

**Observed Output**:

```
 ✓ apps/api/src/documents.test.ts (4 tests) 6875ms
   ✓ Document API & Ingestion Pipeline > rejects uploads with invalid magic bytes 80ms
   ✓ Document API & Ingestion Pipeline > uploads a valid PDF, starts background processing, and returns 201 Created 3971ms
   ✓ Document API & Ingestion Pipeline > rejects duplicate upload with 409 DUPLICATE 949ms
   ✓ Document API & Ingestion Pipeline > returns 404 NOT_FOUND for non-existent document ID 78ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  8.33s
```

### B. Full Test Suite Execution

```bash
$ pnpm test
```

**Observed Output**:

```
 ✓ packages/shared/src/modality.test.ts (7 tests)
 ✓ packages/shared/src/text-normalization.test.ts (11 tests)
 ✓ packages/shared/src/documents.test.ts (3 tests)
 ✓ packages/shared/src/errors.test.ts (6 tests)
 ✓ packages/shared/src/jobs.test.ts (5 tests)
 ✓ packages/shared/src/retrieval.test.ts (3 tests)
 ✓ packages/shared/src/chat.test.ts (3 tests)
 ✓ packages/shared/src/analysis.test.ts (4 tests)
 ✓ packages/shared/src/evidence.test.ts (8 tests)
 ✓ tests/isolation.test.ts (1 test)
 ✓ apps/api/src/documents.test.ts (4 tests)

 Test Files  11 passed (11)
      Tests  55 passed (55)
   Duration  7.99s
```

### C. Compliance, Provenance & Secret Scanning

```bash
$ pnpm run check:forbidden && pnpm run check:fixtures && pnpm run scan:secrets
```

**Observed Output**:

```
> juris@0.1.0 check:forbidden /Users/geetikavasistha/Juris
> node scripts/check-forbidden.mjs

✅ check-forbidden: Scanned 17 product source files. Zero forbidden terms found.

> juris@0.1.0 check:fixtures /Users/geetikavasistha/Juris
> node scripts/check-fixtures.mjs

✅ packages/evals/fixtures/budget-speech-analysis.json: Provenance valid (model=synthetic-script-extractor, prompt_version=synth-v1, request_hash=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
✅ packages/evals/fixtures/gold-set-1.json: Provenance valid (model=human-curated-gold-set, prompt_version=gold-v2, request_hash=b4a8e27c19f53e6d8a7c2b1e4f9a0d3e5c7b9a1f2e4d6c8b0a2f4e6d8c0b2a4e)

All 2 fixtures have valid provenance.

> juris@0.1.0 scan:secrets /Users/geetikavasistha/Juris
> secretlint "**/*"
```

---

## 3. Side Effects

- **Files Created**:
  - `apps/api/src/supabase.ts`: Supabase admin & authenticated user client helpers.
  - `apps/api/src/pipeline/ingestion.ts`: 10-stage document ingestion pipeline.
  - `apps/api/src/routes/documents.ts`: Fastify document endpoints.
  - `apps/api/src/documents.test.ts`: Integration test suite for upload, background ingestion, and retrieval.
- **Files Modified**:
  - `apps/api/src/app.ts`: Registered multipart plugin and document routes.
  - `apps/api/package.json`: Added `test` script and dependencies (`@fastify/multipart`, `pdfjs-dist`, `@supabase/supabase-js`).
  - `packages/shared/src/documents.ts` & `documents.test.ts`: Updated contracts and statuses.
  - `supabase/migrations/20261006000001_initial_schema.sql`: Updated `job_events` RLS policy to `FOR ALL`.
- **Packages Installed**: `@fastify/multipart`, `pdfjs-dist`.
- **Processes**: Local Supabase container restarted via `supabase db reset`.

---

## 4. Unverified / Not Done

1. **Frontend Web UI (Phase 2b)**: Document dropzone, live Realtime progress tracker, split-screen PDF viewer, and ECharts visualizer in `apps/web` (to be executed in Phase 2b).
2. **Live Gemini Adapter Ingestion**: Replay mode and local deterministic extraction verified; live Gemini 1.5 Pro production calls with real API keys will be exercised during benchmark evaluations.
