# Known Gaps and Technical Debt Registry

This document records architectural, verification, and schema gaps identified across Phase 0 and the Phase 1 pre-implementation audit. Each entry records the exact location (`file:line`), current behavior, and resolution phase.

---

## 1. Modality Fact Verification and Ingestion Gaps

### GAP-01: CSV Facts Written with verified=true Without Dual Computation

- **Location:** `apps/api/src/pipeline/ingestion.ts:391`, `apps/api/src/pipeline/ingestion.ts:408`, `apps/api/src/pipeline/ingestion.ts:450`
- **Issue:** Ingestion produces summary facts (`column_sum`, `column_max`, sample rows) with `verified: true` and non-PRD proof string `proof_type: 'computed_from_table'`. No secondary independent computation path (such as DuckDB vs JavaScript agreement) exists.
- **Resolution Plan:** Phase 1 quarantines these rows with `proof_type: 'UNVERIFIABLE'`, `verified: false`, `verification_method: 'none'`. Full dual computation will be implemented in Phase 5 / Phase 7.

### GAP-02: GeoJSON and KML Facts Written with verified=true Without Geometry Checks

- **Location:** `apps/api/src/pipeline/ingestion.ts:784`
- **Issue:** GeoJSON feature count facts are inserted with `verified: true` and non-PRD string `proof_type: 'geo_parsed'`. The system verifies syntax parseability but performs no topological checks, coordinate boundary validation, or gazetteer place-name verification.
- **Resolution Plan:** Phase 1 quarantines rows to `proof_type: 'UNVERIFIABLE'`, `verified: false`. Complete spatial validation will be implemented in Phase 6 / Phase 8.

### GAP-03: Image Dimensions Written as Facts with Non-PRD proof_type Without OCR

- **Location:** `apps/api/src/pipeline/ingestion.ts:1061`
- **Issue:** Image dimension facts (`image_dimension`) are inserted with `verified: true` and non-PRD string `proof_type: 'ocr_crosscheck'`, despite no OCR pipeline existing. Furthermore, image dimensions should reside on `sources.width`/`sources.height` rather than as domain facts.
- **Resolution Plan:** Phase 1 quarantines rows to `proof_type: 'UNVERIFIABLE'`, `verified: false`. Source-level metadata migration and OCR extraction will be addressed in Phase 7 / Phase 9.

---

## 2. Visualization and Overview Engine Gaps

### GAP-04: Client-Side Chart Selection Ahead of Server-Side Storage

- **Location:** `packages/shared/src/chart-selector.ts:38`, `apps/web/src/pages/OverviewStoryboard.tsx:64`
- **Issue:** The v2 PRD specifies that visual specifications are generated and cached server-side in the `public.visual_specs` table. Today, visual specifications are generated entirely client-side in the browser on page load via `selectVisualSpecs`.
- **Resolution Plan:** Recorded in ADR. Database table `visual_specs` remains forward-looking in Phase 1; server-side spec caching and generation will be implemented in Phase 3.

### GAP-05: Verification Rate Computed Client-Side Rather Than Stored on Analyses

- **Location:** `apps/web/src/pages/OverviewStoryboard.tsx:122-126`
- **Issue:** The v2 PRD specifies `verification_rate` as a persisted column on the `public.analyses` table. Today, the overview page computes this on the fly as `facts.filter(f => f.verified).length / facts.length`.
- **Resolution Plan:** Phase 1 adds `verification_rate NUMERIC(5,2)` to `analyses`; migration backfills it, and ingestion persists it during analysis creation.

---

## 3. Database Schema and Contract Discrepancies (Audit V1 - V5)

### GAP-06: Existing public.facts.type Column Collision and Unconstrained Strings (V1)

- **Location:** `supabase/migrations/20261006000001_initial_schema.sql:50`
- **Issue:** `public.facts.type` already exists as `TEXT NOT NULL` without a CHECK constraint. Ingestion and tests write legacy category strings (`financial_total`, `receipt`, `expenditure`, `allocation`, `tax_collection`, `financial_allocation`, `physical_quantity`, `count`, `percentage`, `statistic`, `image_dimension`, `financial`). These conflict with the v2 PRD semantic fact types (`money`, `measure`, `date`, `place`, `entity`, `obligation`, `definition`, `relation`, `identifier`).
- **Resolution Plan:** Phase 1 migration renames existing column to `legacy_type`, updates readers/writers, adds new `type` column (`TEXT NULL, CHECK (type IS NULL OR type IN ('money', 'measure', 'date', 'place', 'entity', 'obligation', 'definition', 'relation', 'identifier'))`), and maps legacy values.

### GAP-07: Unconstrained public.facts.proof_type and Legacy Values (V1)

- **Location:** `supabase/migrations/20261008000001_v2_evidence_graph.sql:6`
- **Issue:** `proof_type` column has no CHECK constraint. Ingestion writes arbitrary strings (`computed_from_table`, `geo_parsed`, `ocr_crosscheck`, lowercase `verified`), violating the 9-value PRD proof type enum.
- **Resolution Plan:** Phase 1 migration preserves existing values in `proof_type_legacy TEXT`, quarantines non-enum values to `UNVERIFIABLE`, and adds a strict CHECK constraint against the 9 PRD enum values.

### GAP-08: Missing proposal.ts and Disconnected Production LLM_MODE (V2)

- **Location:** `apps/api/src/config.ts:21`, `apps/api/src/pipeline/ingestion.ts:1390-1500`
- **Issue:** `proposal.ts` does not exist in the repository. Production PDF ingestion extracts facts using regex heuristics on plain text lines without invoking Gemini or checking `LLM_MODE`. Replay fixtures are only exercised in the spike script (`spikes/s1-llm-structured/run.ts:56`).
- **Resolution Plan:** Planned extraction of `packages/model` will encapsulate prompt templates, schema enforcement, and replay-vs-live runner semantics before wire-up to production pipeline.

### GAP-09: Missing proofType on DocumentFactDetailSchema with Heuristic Fallback (V3)

- **Location:** `packages/shared/src/documents.ts:94`, `packages/shared/src/chart-selector.ts:39`
- **Issue:** `DocumentFactDetailSchema` does not expose `proofType`. `selectVisualSpecs` infers proof type via fallback `f.proofType ?? (f.verified ? 'VERIFIED' : 'UNVERIFIABLE')`.
- **Resolution Plan:** Phase 1 updates `DocumentFactDetailSchema` to include `proofType: ProofTypeSchema` and plumbs it through the API response mapper in `apps/api/src/routes/documents.ts`.

### GAP-10: Unused visual_specs and visual_insights Database Tables (V4 / ADR)

- **Location:** `supabase/migrations/20261008000001_v2_evidence_graph.sql:127,159`
- **Issue:** Tables `visual_specs` and `visual_insights` exist in schema with RLS and foreign keys, but no production API route or worker writes to or reads from them.
- **Resolution Plan:** Documented in ADR as forward-looking schemas; backend persistence hooks will be connected when server-side visual intelligence is scheduled.

### GAP-11: Public Schema Functions Lack of SECURITY DEFINER and Ownership Model (V5)

- **Location:** `supabase/migrations/20261006000001_initial_schema.sql:152,277,310,366`
- **Issue:** RPC functions `claim_next_job`, `match_chunks`, `match_chunks_fts`, and `match_chunks_hybrid` are `SECURITY INVOKER`. `claim_next_job` does not filter by user and requires `service_role` execution; search RPCs rely on invoker-level RLS on `chunks` where `owner_id = auth.uid()`.
- **Resolution Plan:** Maintain `SECURITY INVOKER` for chunk search RPCs. Add explicit isolation integration tests verifying that tenant B cannot access tenant A chunks through search RPCs.
