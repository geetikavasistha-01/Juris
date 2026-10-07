# Evidence: Juris v2 Phase 1 — Evidence Graph Refactor & Contracts

**Date**: 2026-10-08  
**Phase**: Phase 1 — Evidence Graph Refactor & Contracts  
**Status**: Gate Passed ✅

---

## 1. Summary of Changes

1. **`packages/shared/src/evidence.ts`**:
   - Implemented 5 Evidence Span Locators: `text_span`, `table_cell`, `image_region`, `csv_range`, `geo_feature`.
   - Defined 9 Proof Types: `VERIFIED`, `VERIFIED_OCR`, `COMPUTED`, `DERIVED`, `USER_CONFIRMED`, `ESTIMATED`, `CONFLICT`, `UNVERIFIABLE`, `REJECTED`.
   - Added `isOverviewEligibleProofType` guard ensuring approximate/estimated values are strictly gated by default.
   - Added schemas for Entities, Relations, Derived Facts, Reconciliations, Flags, and Review Queue items.
2. **`packages/shared/src/verifiers/text.ts` & `verifiers/index.ts`**:
   - Modularized verifier architecture.
   - Implemented `verifyTextSpanFact` returning `ProofType` and confidence score.
3. **`supabase/migrations/20261008000001_v2_evidence_graph.sql`**:
   - Extended `facts` table with `proof_type`, `span_id`, `confidence_level`, `normalized_value`, `original_text`.
   - Created tables with RLS: `sources`, `evidence_spans`, `tables`, `datasets`, `geo_layers`, `entities`, `relations`, `derived_facts`, `reconciliations`, `flags`, `visual_specs`, `visual_insights`, `review_queue`.

---

## 2. Verification Commands & Observed Results

### A. Shared Unit & Contract Suite

```bash
pnpm test
```

**Output**:

- 13 test files passed (13/13)
- 91 tests passed (91/91), including all new `evidence.test.ts` scenarios.

### B. Typecheck & Lint

```bash
pnpm typecheck && pnpm lint
```

**Output**:

- All 5 workspace projects passed TypeScript checking with zero emit errors.
- ESLint passed with 0 errors and 0 warnings.

### C. Build & Bundle Guard

```bash
pnpm build && pnpm check:bundle
```

**Output**:

- Initial JS Gzip: 200.82 KB (Budget: 300 KB) ✅
- Lazy JS Gzip: 179.07 KB ✅

### D. End-to-End Suite

```bash
pnpm run e2e e2e/ui-states/
pnpm run e2e e2e/real/ --workers=1
```

**Output**:

- 7 UI-state tests passed (3.5s)
- 16 real E2E integration tests passed (54.3s)

---

## 3. Side Effects

- Database migration applied to local Supabase Docker database container `supabase_db_Juris`.
- Added new tables with Row Level Security (RLS) policies.

---

## 4. Not Verified / Next Phase (Phase 2)

- Multi-modal parsing (CSV, GeoJSON, and OCR images) are in contracts; ingestion worker pipelines for modalities are scheduled in subsequent phases.
- Phase 2 will implement the declarative visual engine, deterministic chart selector, and ECharts visual card modules.
