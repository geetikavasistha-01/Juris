# Phase 1 Evidence Report: Contracts, Database Constraints, and Fact Quarantine

- **Slice:** `phase-1-contracts-db`
- **Branch:** `phase-1-contracts-db`
- **Date:** 2026-10-09
- **Status:** Complete

---

## 1. Objectives & Deliverables

1. **P1-T0 (Preflight & Baseline):** Audit existing tables (`documents`, `sources`, `facts`, `analyses`), baseline tests (16 test files, 117 tests passing), verify clean database reset.
2. **P1-T1 (Forward migration: documents and sources):** Migration `20261009000001_phase1_documents_sources.sql`:
   - Added `documents.document_type TEXT NOT NULL DEFAULT 'generic' CHECK (document_type IN ('budget', 'notification', 'tender', 'dataset', 'map', 'generic'))`.
   - Added `sources.width INTEGER` and `sources.height INTEGER` with `CHECK > 0`.
   - Backfilled existing rows and image dimensions.
3. **P1-T2 (Forward migration: facts constraints & numeric normalization):** Migration `20261009000002_phase1_facts_constraints.sql`:
   - Added `facts.fact_type TEXT NOT NULL` with CHECK constraint over the 9 PRD semantic types (`money`, `measure`, `date`, `place`, `entity`, `obligation`, `definition`, `relation`, `identifier`).
   - Added `facts.numeric_value NUMERIC(18,4)` for scale-normalized canonical quantities.
   - Enforced CHECK constraint over the 9 canonical PRD proof types (`VERIFIED`, `VERIFIED_OCR`, `COMPUTED`, `DERIVED`, `USER_CONFIRMED`, `ESTIMATED`, `CONFLICT`, `UNVERIFIABLE`, `REJECTED`) + NULL.
   - Enforced `verified = false OR (verified = true AND proof_type IS NOT NULL)`.
   - Quarantined non-canonical legacy proof strings (`computed_from_table`, `geo_parsed`, `ocr_crosscheck`) to `verified: false, proof_type: null` (GAP-01, GAP-02).
   - Removed synthetic `image_dimension` facts in favor of structural source metadata (GAP-03).
4. **P1-T3 (Forward migration: analyses integrity):** Migration `20261009000003_phase1_analyses_integrity.sql`:
   - Added `analyses.source_fact_ids UUID[] NOT NULL DEFAULT '{}'`.
   - Added CHECK `((summary IS NULL AND key_findings = '[]'::jsonb AND risks = '[]'::jsonb) OR cardinality(source_fact_ids) > 0)`.
5. **P1-T4 (Pipeline & Test alignment):**
   - Updated `apps/api/src/pipeline/ingestion.ts` to assign `fact_type`, `numeric_value`, and quarantine unverified multimodal facts.
   - Set image dimensions on `sources.width/height` with zero synthetic facts.
   - Updated `apps/api/src/documents.test.ts` cascade and multimodal test assertions.
6. **P1-T5 (Shared contracts & drift guards):**
   - Exported `DocumentTypeSchema`, `SemanticFactTypeSchema`, `ProofTypeSchema` in `@juris/shared`.
   - Plumbed `proofType`, `numericValue`, and `factType` through `DocumentFactDetailSchema` and API response mapper in `apps/api/src/routes/documents.ts`.
   - Added live database drift guard test suite `tests/schema-drift.test.ts`.
7. **P1-T6 (Tenant isolation across all 13 Evidence Graph tables):**
   - Added comprehensive JWT-scoped test suite `tests/rls-evidence-graph.test.ts` verifying all 13 Evidence Graph tables across User A, User B, and Anon.
8. **P1-T7 (Documentation & Records):**
   - Added ADR-013 (`docs/adr/013-phase-1-evidence-graph-contracts-and-constraints.md`).
   - Updated `docs/known-gaps.md` (GAP-01, GAP-02, GAP-03, GAP-05, GAP-06, GAP-07, GAP-09 resolved).
   - Updated `docs/roadmap.md`.

---

## 2. Commands Run & Observed Results

### Database Reset & Migrations

```bash
$ supabase db reset
Resetting local database...
Applying migration 20261006000001_initial_schema.sql...
Applying migration 20261007000001_null_fabricated_analyses.sql...
Applying migration 20261008000001_v2_evidence_graph.sql...
Applying migration 20261009000001_phase1_documents_sources.sql...
Applying migration 20261009000002_phase1_facts_constraints.sql...
Applying migration 20261009000003_phase1_analyses_integrity.sql...
Finished supabase db reset on branch phase-1-contracts-db.
```

**Result:** Code 0. Clean reset with zero errors.

### Schema Drift & Constraint Test

```bash
$ pnpm vitest run tests/schema-drift.test.ts
 ✓ tests/schema-drift.test.ts (4 tests) 644ms
   ✓ Schema Drift & DB Constraint Verification (P1-T5) > guarantees shared DocumentTypeSchema matches documents.document_type DB constraint 183ms
   ✓ Schema Drift & DB Constraint Verification (P1-T5) > guarantees shared SemanticFactTypeSchema matches facts.fact_type DB constraint 81ms
   ✓ Schema Drift & DB Constraint Verification (P1-T5) > guarantees shared ProofTypeSchema matches facts.proof_type DB constraint 108ms
   ✓ Schema Drift & DB Constraint Verification (P1-T5) > verifies analyses source_fact_ids grounding constraint in DB 14ms
Test Files 1 passed (1)
```

**Result:** Code 0. Live DB constraints strictly mirror shared Zod schemas.

### 13 Evidence Graph Tables Tenant Isolation Test

```bash
$ pnpm vitest run tests/rls-evidence-graph.test.ts
 ✓ tests/rls-evidence-graph.test.ts (1 test) 1320ms
   ✓ Evidence Graph 13 Tables RLS & Tenant Isolation (P1-T6) > strictly isolates all 13 Evidence Graph tables across User A, User B, and Anon 439ms
Test Files 1 passed (1)
```

**Result:** Code 0. Authenticated User A can read/write; User B sees 0 rows and cannot write; Anon sees 0 rows.

### Workspace Test Suite

```bash
$ pnpm test
 Test Files  17 passed (17)
      Tests  121 passed (121)
   Duration  21.98s
```

**Result:** Code 0. All 17 test suites and 121 tests pass without regression.

### Static Analysis & Quality Gates

```bash
$ pnpm lint && pnpm typecheck && pnpm check:requirements && pnpm check:forbidden
eslint . -> 0 errors, 0 warnings
tsc (packages/shared, apps/api, apps/web, e2e) -> 0 errors
check-requirements -> All 34 requirements validated
check-forbidden -> Scanned 65 product source files. Zero forbidden terms found.
```

**Result:** Code 0 across all checks.

---

## 3. Side Effects

- **Files Changed:**
  - `supabase/migrations/20261009000001_phase1_documents_sources.sql` (added)
  - `supabase/migrations/20261009000002_phase1_facts_constraints.sql` (added)
  - `supabase/migrations/20261009000003_phase1_analyses_integrity.sql` (added)
  - `apps/api/src/pipeline/ingestion.ts` (fact typing, scale normalization, quarantine)
  - `apps/api/src/routes/documents.ts` (API response mapper plumbing)
  - `apps/api/src/documents.test.ts` (cascade and multimodal assertions)
  - `packages/shared/src/documents.ts` (schemas for document_type, semantic fact_type, proof_type)
  - `tests/schema-drift.test.ts` (added)
  - `tests/rls-evidence-graph.test.ts` (added)
  - `docs/adr/013-phase-1-evidence-graph-contracts-and-constraints.md` (added)
  - `docs/known-gaps.md` (updated)
  - `docs/roadmap.md` (updated)
- **Packages Installed:** None.
- **Processes Started/Stopped:** Docker containers restarted during `supabase db reset`.

---

## 4. Not Verified

- Production LLM inference against live Gemini 2.5 API (not part of Phase 1; `LLM_MODE=mock` exercised in automated tests; live LLM evaluated in spike/local-ai).
- Multimodal dual computation (DuckDB computation for CSV tabular data and spatial topological checks are planned for Phases 7 and 8).
