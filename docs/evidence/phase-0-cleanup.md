# Evidence: Phase 0 (Cleanup and Hygiene)

**Date:** 2026-10-08  
**Repository:** `Juris` (`phase-0-cleanup` branch)  
**Phase:** Phase 0 - Cleanup and Hygiene  
**Status:** PASSED

---

## 1. Summary of Changes

1. **Script Deletions:**
   - Deleted `scripts/null-analyses.mjs` (SQL migration `supabase/migrations/20261007000001_null_fabricated_analyses.sql` retained).
2. **Component & Module Cleanup:**
   - Deleted obsolete unreferenced chart component `apps/web/src/components/visuals/DocumentVisuals.tsx`.
   - Merged `apps/web/src/lib/echarts-setup.ts` into `apps/web/src/lib/echarts.ts` as a unified lazy-loaded modular ECharts engine.
   - Refactored `apps/api/src/server.ts` to export `buildServer()` (and `buildApp()` backwards-compatible alias), keeping `apps/api/src/index.ts` as a thin runtime entry point.
3. **Link & Documentation Hygiene:**
   - Replaced all `file:///Users/...` absolute links in `docs/` with relative markdown links.
   - Created `docs/known-gaps.md` documenting multimodal heuristics and upcoming phase items.
4. **Configuration & Developer Tooling:**
   - Added `.editorconfig` at repository root.
   - Added `.env.example` templates in `apps/api/` and `apps/web/` without exposing secrets.
   - Updated `.gitignore` to include `stitch_juris/` and `.husky/_/`.
   - Verified `.husky/pre-commit` and `.lintstagedrc.json` configuration.
   - Formatted codebase using Prettier.
5. **Local PDF.js Fonts & CMaps Configuration:**
   - Configured `standardFontDataUrl` and `cMapUrl` referencing local `pdfjs-dist/standard_fonts/` and `pdfjs-dist/cmaps/` in `apps/api/src/routes/documents.ts` and `apps/api/src/pipeline/ingestion.ts`, eliminating font missing warnings.
6. **Per-Suite DB Timeouts:**
   - Restored global vitest timeout to 15s in `vitest.config.ts`.
   - Configured explicit `{ timeout: 60000 }` on DB integration test suites (`apps/api/src/documents.test.ts` and `tests/isolation.test.ts`).
7. **Accessibility & Contrast:**
   - Added `aria-label`s to select dropdowns and search inputs in `DocumentLibraryPage.tsx`.
   - Corrected dark/light contrast classes on tab count badges and filter inputs.

---

## 2. Phase Gate Verification Results

| Check / Gate Command                                                    | Status   | Output / Observed Result                                               |
| :---------------------------------------------------------------------- | :------- | :--------------------------------------------------------------------- |
| `pnpm -r typecheck`                                                     | **PASS** | 5 of 5 workspace projects pass cleanly with 0 TypeScript errors.       |
| `pnpm run lint`                                                         | **PASS** | ESLint executed across entire repo with 0 errors and 0 warnings.       |
| `pnpm run format:check`                                                 | **PASS** | Prettier format check passes across all files.                         |
| `pnpm test`                                                             | **PASS** | 16 test suites, 114 tests passing (unit + isolation + DB tests).       |
| `pnpm exec playwright test --config e2e/playwright.config.ts e2e/real/` | **PASS** | 16 of 16 real flow & Axe Core WCAG 2.1 AA accessibility tests passing. |
| `pnpm run check:tokens`                                                 | **PASS** | All token assertions verified.                                         |
| `pnpm run check:contrast`                                               | **PASS** | All 60 WCAG AA contrast checks passed (100% compliant).                |
| `pnpm run check:bundle`                                                 | **PASS** | Initial bundle gzip: 217.13 KB (within 300 KB budget).                 |
| `pnpm run check:external-hosts`                                         | **PASS** | 0 external host leaks; all assets 100% self-hosted.                    |
| `pnpm run check:visual-specs`                                           | **PASS** | All visual specs enforce point-to-fact provenance.                     |
| `pnpm run check:forbidden`                                              | **PASS** | Scanned 65 product files; zero forbidden terms found.                  |
| `pnpm run check:fixtures`                                               | **PASS** | All fixtures validated with hashes and provenance.                     |
| `pnpm run build`                                                        | **PASS** | All workspace packages and Vite production bundle build cleanly.       |

---

## 3. Side Effects

- **Files Deleted Outside Core Scope:** `scripts/null-analyses.mjs`, `apps/web/src/components/visuals/DocumentVisuals.tsx`, `apps/web/src/lib/echarts-setup.ts`.
- **Files Created:** `.editorconfig`, `apps/api/.env.example`, `apps/web/.env.example`, `apps/api/src/server.ts`, `docs/evidence/phase-0-cleanup.md`, `docs/known-gaps.md`.
- **Packages Installed:** None.
- **Processes Started/Stopped:** Supabase local container, API test instance, and Playwright test workers.

---

## 4. Not Verified / Human Review Items

- Live external Gemini multimodal extraction in production environment (fixture-backed replay active for gate tests; live execution requires cloud API keys).
