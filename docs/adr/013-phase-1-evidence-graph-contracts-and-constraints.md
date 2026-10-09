# ADR-013: Phase 1 Evidence Graph Contracts, DB Constraints, and Fact Quarantine

- **Status:** Accepted
- **Date:** 2026-10-09

## Context

In Juris v1, facts were extracted primarily as simple financial allocations or raw string values with loose typing. With the expansion to multimodal ingestion (PDF, CSV, GeoJSON, KML, image) in Juris v2, several integrity and contract gaps emerged (documented in `docs/known-gaps.md` as GAP-01, GAP-02, GAP-03, GAP-06, GAP-07, and GAP-09):

1. Facts wrote non-canonical proof strings (`computed_from_table`, `geo_parsed`, `ocr_crosscheck`) marked `verified: true` without independent dual-computation or OCR verification.
2. The `facts.type` column was unconstrained and conflicted with the 9 canonical semantic fact types from PRD v2.
3. Image dimensions were recorded as synthetic facts rather than structural metadata on the `sources` table.
4. Scale-normalized numeric values (e.g., Crore to integer representation) lacked a canonical database column, causing downstream arithmetic ambiguity.
5. The `analyses` table permitted ungrounded synthesis rows with non-empty summaries but zero supporting verified fact IDs.
6. The shared frontend/backend contract `DocumentFactDetailSchema` lacked `proofType`, causing client-side heuristic fallbacks.

## Decision

1. **Strict Semantic Fact Types (`facts.fact_type`):**
   Enforce a NOT NULL column with a CHECK constraint over the exact 9 semantic types defined in PRD v2:
   `('money', 'measure', 'date', 'place', 'entity', 'obligation', 'definition', 'relation', 'identifier')`.
   A before-insert trigger auto-maps legacy types for backwards compatibility.

2. **Canonical Proof Types (`facts.proof_type`):**
   Enforce a CHECK constraint permitting NULL or one of the 9 canonical PRD proof types:
   `('VERIFIED', 'VERIFIED_OCR', 'COMPUTED', 'DERIVED', 'USER_CONFIRMED', 'ESTIMATED', 'CONFLICT', 'UNVERIFIABLE', 'REJECTED')`.
   Enforce that `verified = true` strictly requires `proof_type IS NOT NULL`.

3. **Fact Quarantine (GAP-01, GAP-02):**
   All CSV tabular facts, GeoJSON features, and KML spatial placemarks extracted without independent dual computation or topological validation are quarantined in Phase 1 to `verified = false` and `proof_type = NULL`. They will be elevated to `COMPUTED` or `VERIFIED` in modality-specific phases (Phases 5-8).

4. **Source Metadata Migration (GAP-03):**
   Structural image dimensions are placed directly on `sources.width` and `sources.height` (`INTEGER CHECK > 0`). Synthetic `image_dimension` facts are removed and no longer produced.

5. **Scale Normalization (`facts.numeric_value`):**
   Add `numeric_value NUMERIC(18,4)` storing canonical scale-normalized quantities (up to 100 trillion, sufficient for national budgets).

6. **Analyses Grounding Integrity Check:**
   Enforce database-level constraint `analyses_grounded_integrity_check`:
   `CHECK ((summary IS NULL AND key_findings = '[]'::jsonb AND risks = '[]'::jsonb) OR cardinality(source_fact_ids) > 0)`.

7. **Document Types (`documents.document_type`):**
   Enforce CHECK constraint over canonical types:
   `('budget', 'notification', 'tender', 'dataset', 'map', 'generic')`.

8. **Full Shared Contract Plumbing & Schema Drift Guards:**
   Export `DocumentTypeSchema`, `SemanticFactTypeSchema`, `ProofTypeSchema` in `@juris/shared`.
   Add end-to-end schema drift tests validating database CHECK constraints against shared Zod enums.
   Add tenant isolation integration tests asserting complete RLS protection across all 13 Evidence Graph tables for User A, User B, and Anon.

## Consequences

- **Positive:** Mathematical guarantee that unverified facts cannot enter synthesis or visualizations; strict type safety across database and API contracts; zero drift between Postgres and Zod schemas.
- **Negative / Trade-offs:** CSV and spatial facts are displayed as unverified/quarantined in Phase 1 until full dual computation and geometry validation engines are implemented in subsequent phases.

## Evidence Links

- `docs/prd-v2.md` Sections 2.1, 2.2, 2.3
- `docs/known-gaps.md` GAP-01, GAP-02, GAP-03, GAP-06, GAP-07, GAP-09
- Migrations: `20261009000001_phase1_documents_sources.sql`, `20261009000002_phase1_facts_constraints.sql`, `20261009000003_phase1_analyses_integrity.sql`
- Tests: `tests/schema-drift.test.ts`, `tests/rls-evidence-graph.test.ts`
