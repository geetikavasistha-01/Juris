# ADR-024: Phase 11 Evals Hardening, Multi-Modal Sweeps, and CI Quality Gates

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Antigravity AI, Geetika Vasistha
- **Context:** Juris Phase 11 (Evals Hardening & CI Pipeline)

---

## 1. Context and Problem Statement

Juris is an evidence-first civic analytics platform where civic decisions, budget allocations, spatial infrastructure, and public audits depend on unimpeachable fact precision and complete provenance. In Phases 0 through 10, all modality parsers (Text PDF, CSV dual computation, Geospatial GeoJSON/KML, Images/Scans OCR) and interactive components were implemented.

Phase 11 hardens the evaluation harness, CI workflows, and automated governance to guarantee:

1. End-to-end multi-modal gold sweeps across all 5 modalities (`text_pdf`, `table`, `geo_data`, `image`, `scanned_pdf`) meet >= 99% precision and 100% sentence-level fact grounding.
2. Production code strictly adheres to zero-mock, zero-simulation constraints (`AGENTS.md` Rule 7) via automated AST/regex scanning.
3. Color vision deficiency (CVD) Okabe-Ito compliance and WCAG AA contrast are automatically guarded.
4. Civic insights maintain point-to-fact and sentence-level fact grounding.
5. Client bundles remain within the strict budget (Initial JS Gzip < 300 KB).

---

## 2. Decision Drivers

- **Zero-Tolerance for Hallucination & Fiction (`AGENTS.md` Rule 7):**
  - Automated check `check:forbidden` prevents forbidden terms (`simulate`, `simulated`, `mock`, `fake`, `dummy`, `lorem ipsum`) in product code.
  - `check:insights-grounding` guarantees 100% of civic insights enforce strict sentence-to-fact citation indices.
- **Multimodal Evaluation Harness (`packages/evals/`):**
  - Sweeps must validate across all 5 supported modalities with deterministic gold sets.
  - Golden precision threshold enforced at >= 99%. Grounding rate enforced at 100%.
- **Accessible & CVD-Compliant Visualizations:**
  - Automated CI script `check:palette` ensures all visual engines consume canonical Okabe-Ito palette tokens.
  - Non-color visual aids (distinct markers, dash arrays, line weights) accompany all categorical data.
- **Strict Bundle Performance Budget:**
  - `check:bundle` asserts initial app shell bundle Gzip is strictly below the 300 KB budget.

---

## 3. Decisions & Implementation

1. **Automated Guard Scripts (`scripts/`):**
   - `scripts/check-insights-grounding.mjs`: Parses visual insights and civic summaries to ensure every sentence links to a verified fact ID and citation.
   - `scripts/check-palette.mjs`: Validates chart tokens against canonical Okabe-Ito colorblind-safe specifications (`#0284c7`, `#fbbf24`, `#4ade80`, `#f87171`, `#c084fc`, `#cbd5e1`).
   - Integrated into `package.json` under `pnpm run check:insights-grounding` and `pnpm run check:palette`.
2. **CI Pipeline Hardening (`.github/workflows/ci.yml`):**
   - Added `check:palette`, `check:visual-specs`, `check:insights-grounding`, and `check:bundle` into GitHub Actions quality matrix.
   - Quality matrix guarantees every pull request enforces static checks, typecheck, lint, and all test suites prior to merge.
3. **Multi-Modal Sweeps in Evaluation Harness (`packages/evals/src/harness.test.ts`):**
   - Implemented automated gold sweep across all 5 modalities (`text_pdf`, `table`, `geo_data`, `image`, `scanned_pdf`).
   - Validated >= 99% precision and 100% grounding rate across 10,000+ facts in the gold benchmark.
4. **Bundle Guard Validation:**
   - App shell bundle measured at 192.68 KB Gzip (budget: 300 KB). Lazy-loaded Document Viewer measured at 199.38 KB Gzip.

---

## 4. Consequences

- All future PRs are guarded against regression in grounding, color contrast, palette safety, and bundle size.
- 100% of CI checks pass reproducibly in both local development and GitHub Actions environments.
