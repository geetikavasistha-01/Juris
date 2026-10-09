# Juris Project Roadmap: 12-Phase Unified Plan

Version: 2.0  
Status: Active  
Current Branch: `phase-1-contracts-db`  
Prerequisites: Phase 0 Complete (PR #1 and PR #2 merged into `main`)

---

## 1. Executive Summary

This roadmap integrates the foundational requirements from Juris v1 (`docs/prd.md`), the multimodal and visual intelligence requirements from Juris v2 (`docs/prd-v2.md`), the Phase 1 architectural amendments, and the Local AI evaluation spike.

Every phase operates under strict quality gates:

1. Work on one slice at a time; no unassigned file edits (`AGENTS.md` Rule 2).
2. Contracts first in `packages/shared`, tests first, zero mock data in product code (`AGENTS.md` Rules 3, 4, 7).
3. Every phase updates the README quickstart, records decisions in `docs/adr/`, and produces an evidence file in `docs/evidence/<phase>.md` (`AGENTS.md` Rules 12, 15).
4. No phase proceeds to the next until all CI checks pass and tests verify against real data.

---

## 2. Phase Breakdown

```text
Phase 0 [DONE] -> Phase 1 [IN PROGRESS] -> [Spike: Local AI] -> Phase 2 -> Phase 3 -> Phase 4
    -> Phase 5 -> Phase 6 -> Phase 7 -> Phase 8 -> Phase 9 -> Phase 10 -> Phase 11 -> Phase 12
```

---

### Phase 0: Cleanup & Repo Hygiene (COMPLETED)

- **Status:** Merged into `main` via PR #1 and PR #2.
- **Deliverables Completed:**
  - Standardized repo structure and workspace boundaries.
  - Added MIT `LICENSE`.
  - Restored full 4-test coverage in `apps/api/src/app.test.ts`.
  - Added multimodal fact assertions across CSV, GeoJSON, KML, and PNG in `apps/api/src/documents.test.ts`.
  - Enforced `useSystemFonts: false` in PDF.js extraction to ensure deterministic hashes locally and in CI.
  - Quarantined invalid PNG fact verification methods.
  - Documented technical debt and schema gaps in `docs/known-gaps.md`.

---

### Phase 1: Contracts, Database Schema & Quarantine (COMPLETED)

- **Branch:** `phase-1-contracts-db`
- **Goal:** Establish authoritative shared contracts and database schema for the v2 Evidence Graph without breaking existing v1 behaviour.
- **Key Amendments (A1–A5):**
  - **A1 (Fact Type Schema):** Rename legacy column to `facts.legacy_type` and add `facts.fact_type` with CHECK constraint against the 9 semantic types: `money`, `measure`, `date`, `place`, `entity`, `obligation`, `definition`, `relation`, `identifier`.
  - **A2 (Proof Type Schema):** Rename unconstrained column to `facts.proof_type_legacy`, preserve values, and introduce `facts.proof_type` with strict CHECK constraint against the 9 PRD proof types: `VERIFIED`, `VERIFIED_OCR`, `COMPUTED`, `DERIVED`, `USER_CONFIRMED`, `ESTIMATED`, `CONFLICT`, `UNVERIFIABLE`, `REJECTED`. Quarantine legacy non-conforming rows to `UNVERIFIABLE`.
  - **A3 (Scale Normalization):** Add `facts.numeric_value NUMERIC(18,4)` for scale-normalized quantities alongside original raw strings.
  - **A4 (Analyses Integrity):** Add `source_fact_ids UUID[] DEFAULT '{}'` to `analyses` with CHECK constraint: `CHECK ((summary IS NULL AND (key_findings IS NULL OR key_findings = '[]'::jsonb) AND (risks IS NULL OR risks = '[]'::jsonb)) OR cardinality(source_fact_ids) > 0)`. Add `verification_rate NUMERIC(5,2)`.
  - **A5 (Contract Plumbing):** Expose `proofType` on `DocumentFactDetailSchema` and plumb it through the API response mapper in `apps/api/src/routes/documents.ts` without heuristic fallbacks.
- **Gate:** All existing tests pass; no visual regression; no unverified facts promoted to verified.

---

### Spike: Local AI & Docling Evaluation (POST-PHASE 1)

- **Branch:** `spike/local-ai`
- **Constraint:** Starts ONLY after Phase 1 is merged into `main`. No changes to production behaviour; isolated spike branch.
- **Objectives:**
  1. Verify and document that Docling does not have an npm package; configure Docling as a Python HTTP sidecar (`docling-serve`).
  2. Implement a provider interface in `packages/model` (`generateFacts` with Zod-validated structured output, `temperature: 0`).
  3. Providers: Gemini (default), Ollama (`llama3.1:8b-instruct-q8_0` and `qwen2.5:7b-instruct-q8_0`), and recorded replay (fail-closed in production).
  4. Docker Compose profile `"local-ai"` for optional local sidecars; default quickstart remains untouched.
  5. Evaluate speed, fact precision, and schema adherence on the budget gold set.
  6. Deliver decision record in `docs/adr/008-local-llm-and-docling.md`.

---

### Phase 2: Design System, Foundations & 4 Themes (COMPLETED)

- **Branch:** `phase-2-design-system`
- **Goal:** Build the complete visual design foundation, tokens, and theme system.
- **Deliverables Completed:**
  - Exactly 4 themes in `packages/shared` / `apps/web`: **Matcha Light**, **Matcha Dark**, **Mono Light**, **Mono Dark** (High Contrast and Civic/Slate removed).
  - Categorical colour-blind safe palette in `tokens.css` verified by `check-contrast.mjs` (100% WCAG AA compliance across 120 checks).
  - UI primitives implemented: `Toggle` and `Sheet` added with accessible ARIA semantics and focus trap containment.
  - Evaluation harness skeleton in `packages/evals` with standard PRD threshold constants (Fact Precision >= 99%, Grounding Pass Rate 100%).
  - Recorded in `docs/adr/015-phase-2-design-system-and-themes.md` and evidence in `docs/evidence/phase-2-design-system.md`.
- **Gate:** All 120 WCAG AA contrast checks passed; 0 token violations; all 20 test files (133 tests) passing; production builds passing.

---

### Phase 3: Visual Engine Foundations & Chart Selector

- **Goal:** Implement the deterministic chart selection engine and declarative visual specification layer.
- **Deliverables:**
  - Declarative Visual Spec schema (`packages/shared/src/visual-spec.ts`): `{ id, kind, title, encodings, series[{ label, value, factIds[] }], proofSummary, filters, a11yTable }`.
  - Deterministic Chart Selector (`packages/shared/src/chart-selector.ts`): maps data shape, hierarchy, flow, and time series to ranked chart types.
  - Code chooses charts; LLM never writes chart specs or numeric values.
  - Web VisualCard component, ProofBadge component, and lazy-loaded ECharts modules (parts, time, flow).
  - URL-synchronized selection store (`selection-store.ts`) for shareable cross-filtering.
- **Gate:** Sample budget document produces at least 5 distinct chart candidates automatically; zero chart data points exist without linked source fact IDs.

---

### Phase 4: Core User Journeys & App Shell (COMPLETED)

- **Status:** COMPLETED
- **Goal:** Complete the primary navigation, authentication, and document lifecycle views.
- **Deliverables:**
  - Home page, Login, Signup, and Workspace/Document Library views.
  - Document upload with client-side format checks and server-authoritative enforcement.
  - Live processing view with WebSocket status and polling fallback across ingestion stages.
  - Empty states: honest explanations for empty, unverified, or rejected extractions.
- **Gate:** Real user journey passes end-to-end: upload PDF -> watch live progress -> inspect library -> view document. (VERIFIED)

---

### Phase 5: Insight Panel, Grounding Checker & Haptics (COMPLETED)

- **Status:** COMPLETED
- **Goal:** Interactive deep dive into visuals with proven plain-language summaries and tactile feedback.
- **Deliverables:**
  - Grounding Checker (`packages/shared/src/grounding.ts`): verifies that every number in an insight sentence matches cited facts, comparative terms hold mathematically, and entities are present in source facts. Failing sentences are dropped.
  - Deterministic template generator (`insight-templates.ts`) ensuring 100% reliable fallback summaries.
  - Optional LLM insight generation with strict grounding check before storage.
  - Slide-over Insight Panel (bottom sheet on mobile) with 3 reading levels: Simple, Standard, Expert.
  - Progressive haptic feedback module (`apps/web/src/lib/haptics.ts`) using the Vibration API with reduced-motion support.
- **Gate:** 100% of displayed insight sentences pass the grounding checker; adversarial sentences with altered numbers are caught and rejected in unit tests. (VERIFIED)

---

### Phase 6: Advanced PDF Extraction & Document Storyboard (COMPLETED)

- **Status:** COMPLETED
- **Goal:** Deep multi-pass PDF extraction and the full "Document at a Glance" storyboard.
- **Deliverables:**
  - Multi-column reading order detection, running header/footer stripping, footnote linking.
  - Ruled and unruled table reconstruction with cell unit/scale propagation ("in crore", "in million").
  - Multi-pass pipeline: Structure -> Propose -> Normalize -> Verify -> Reconcile -> Derive -> Flag.
  - "Document at a Glance" storyboard: 8-step layman view (What is this, Big numbers, Where money goes, What changed, When things happen, Where, Who, Things to know).
- **Gate:** Budget gold set achieves >= 99% fact precision; storyboard renders complete visual story from verified facts. (VERIFIED)

---

### Phase 7: CSV Modality & DuckDB Dual-Computation (COMPLETED)

- **Status:** COMPLETED
- **Goal:** Support tabular civic files with provable dual-computation verification.
- **Deliverables:**
  - CSV/TSV parser supporting UTF-8 and common encodings (up to 50 MB, 500,000 rows).
  - Code-computed dataset profiler (null rates, quartiles, IQR outliers, correlations, geo columns).
  - Dual-computation verifier: JavaScript path vs embedded DuckDB SQL path; numbers are COMPUTED only if both paths agree exactly.
  - CSV-specific charts: distribution histograms, box plots, correlation heatmaps, calendar heatmaps.
  - CSV injection protection (neutralizing `=`, `+`, `-`, `@` formulas on export).
- **Gate:** Seeded arithmetic discrepancy between JS and DuckDB triggers automatic rejection in unit tests. (VERIFIED)

---

### Phase 8: Maps & Geospatial Modality

- **Goal:** Vector geospatial ingestion and gazetteer-linked interactive mapping.
- **Deliverables:**
  - Vector parsers for GeoJSON, TopoJSON, KML, GPX, and zipped Shapefiles.
  - Reprojection to WGS84 via `proj4`, geometry validation and simplification via `turf`.
  - Offline bundled gazetteer in `packages/geodata` (national, state, and district boundaries < 3 MB).
  - Choropleth and bubble/point maps drawing vector paths without external tile servers.
  - Place-name extraction and disambiguation from PDFs and CSVs; neutral boundary disclaimer in footer.
- **Gate:** Geospatial fixtures parse, reproject, and verify; ambiguous place names are flagged rather than guessed.

---

### Phase 9: Images & Scanned PDFs Modality

- **Goal:** Visual OCR and vision model extraction for scanned pages and images.
- **Deliverables:**
  - Ingestion of PNG, JPEG, WebP, single-page TIFF (up to 25 MB, 8000 px).
  - Preprocessing with `sharp` (stripping EXIF/GPS, deskewing, denoising).
  - Self-hosted WASM OCR (`tesseract.js`) producing token bounding boxes and confidence scores.
  - Vision model (Gemini structured output, `temperature: 0`) for titles, tables, regions.
  - OCR verification against confidence floor (`OCR_CONFIDENCE_FLOOR=80`); items above floor receive `VERIFIED_OCR`, items below route to `review_queue`.
  - Chart image values marked as `ESTIMATED` with distinct dashed styling unless labels are OCR-verified.
- **Gate:** Scanned budget page gold set passes OCR threshold; low-quality scans produce review items instead of unverified facts.

---

### Phase 10: Review Queue & Document Inspector

- **Goal:** Human-in-the-loop audit interface and full document exploration.
- **Deliverables:**
  - Review queue UI for low-confidence OCR and estimated facts; user approval transitions item to `USER_CONFIRMED`.
  - Fact Inspector with filtering by semantic type, proof type, confidence, and page.
  - Citation Drawer with direct bounding box highlighting and excerpt display.
  - Conflict view displaying side-by-side values when two verified sources disagree (`CONFLICT`).
  - Document glossary underlining defined terms with cited definitions.
- **Gate:** User confirmation workflow verified end-to-end; human review tool is the sole mechanism for approving review queue items (`AGENTS.md` Rule 8).

---

### Phase 11: Evaluation Harness, CI Hardening & Gold Sweeps

- **Goal:** Comprehensive quantitative validation across all modalities and strict performance budgets.
- **Deliverables:**
  - End-to-end gold set evaluation sweeps across PDF, scan, CSV, image, and GeoJSON.
  - Enforce metric gates: fact precision >= 99%, recall target met, grounding pass rate 100%.
  - Automated check scripts: `check-visual-specs.mjs`, `check-insights-grounding.mjs`, `check-palette.mjs`, `check-bundle.mjs`.
  - Bundle size enforcement (lazy chart modules under budget).
  - Full CI workflow with matrix test runner and branch protection checks.
- **Gate:** All checks and test suites pass twice consecutively on clean environments.

---

### Phase 12: Production Readiness, ADR Catalog & Documentation

- **Goal:** Final release packaging, developer documentation, and operational hygiene.
- **Deliverables:**
  - Comprehensive `README.md` with zero-config localhost quickstart.
  - Complete ADR catalog in `docs/adr/` capturing every architectural decision.
  - Threat model update (`docs/threat-model.md`) reflecting multimodal parsers and sidecar isolation.
  - Evidence index connecting all phase deliverables to `docs/evidence/`.
- **Gate:** Clean clone passes one-command setup, builds, runs migrations, and passes all tests.
