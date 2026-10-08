## Summary of Phase 0 Cleanup & Hygiene

This PR implements Phase 0 repository hygiene, debt reduction, and codebase cleanup as specified in the project roadmap. It establishes code ownership, branching policies, pre-commit enforcement, and documents all known gaps ahead of Phase 1.

### 1. Revised Readiness Table

| Subsystem                                         | Readiness Status | Verification & Evidence                                                                                                   | Notes / Boundaries                                                                                                    |
| :------------------------------------------------ | :--------------- | :------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------- |
| **Frontend (`apps/web`)**                         | Ready            | TypeScript 5.8 clean, ESLint clean, Vite production build clean. 16 real Playwright E2E tests passing.                    | Includes 12 WCAG 2.1 AA automated accessibility scans across light and dark themes.                                   |
| **Backend (`apps/api`)**                          | Ready            | TypeScript 5.8 clean, ESLint clean. 16 Vitest test suites (114 tests) passing. Real upload flow and socket drop verified. | Existing tests cover API-level 404 isolation. DB/RLS-level multi-tenant isolation is unverified until Phase 1 suites. |
| **Contracts (`packages/shared`)**                 | Ready            | Single source of truth for evidence, visual specs, and insight schemas. Zero duplicate types.                             | Grounding and provenance assertion guards active.                                                                     |
| **Model / Pipeline (`packages/evals`, `spikes`)** | Ready            | Deterministic replay fixtures pass in CI with zero secret exposure (`GEMINI_API_KEY` never required for CI).              | Live Gemini calls are manual or nightly only. Production PDF ingestion operates deterministically via regex.          |

_Clarification on Existing Capabilities:_ The CSV and GeoJSON parsers, the Overview Storyboard tab, and the deterministic insight generation are v2 features that already exist in the codebase ahead of their scheduled phases (Phases 3, 7, and 8). They are tracked as known gaps and technical debt, not Phase 0 baseline.

---

### 2. Known Gaps and Technical Debt Registry

All identified architectural discrepancies, unproven modality facts, and schema gaps are tracked in [docs/known-gaps.md](file:///Users/geetikavasistha/Juris/docs/known-gaps.md) with exact `file:line` locations:

- **GAP-01 to GAP-03:** CSV, GeoJSON, and image dimension facts written with `verified=true` and non-standard proof strings without dual computation (DuckDB), topological validation, or OCR. Scheduled for quarantine in Phase 1 and full dual-computation resolution in Phases 5, 6, and 7.
- **GAP-04 & GAP-05:** Client-side visual spec selection and client-computed verification rates ahead of planned server-side persistence in `visual_specs` and `analyses`.
- **GAP-06 & GAP-07:** Existing `public.facts.type` column collision and unconstrained `proof_type` strings to be migrated and constrained in Phase 1.
- **GAP-08:** Disconnected production `LLM_MODE` and extraction of `packages/model`.
- **GAP-09:** Missing `proofType` property on `DocumentFactDetailSchema`.
- **GAP-10 & GAP-11:** Unused forward-looking tables (`visual_specs`, `visual_insights`) and public schema search RPCs security model.

---

### 3. Changes Implemented in Phase 0

- Deleted deprecated `scripts/null-analyses.mjs`, legacy fact cards, obsolete chart components, and unused dependencies identified by `depcheck`.
- Refactored backend entry point into `buildServer()` factory plus thin `index.ts` launcher.
- Unified ECharts rendering into a single lazy-loaded chunk (`LazyChart.tsx`).
- Removed redundant client-side PDF page-count check and its tests.
- Localized `pdfjs-dist` standard fonts and CMaps to eliminate external CDN dependencies.
- Replaced global vitest timeouts with per-suite database configuration.
- Added repository hygiene tooling: `.github/CODEOWNERS`, `docs/branching.md`, `.lintstagedrc.json`, Husky pre-commit hooks, and Prettier configuration.
