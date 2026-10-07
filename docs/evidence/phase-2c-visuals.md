# Phase 2c Evidence: Civic Visual Analytics & Modular ECharts Chunking

**Date**: 2026-10-07
**Status**: PASSED / VERIFIED

---

## 1. Overview & Architecture

Phase 2c implements civic visual analytics directly derived from real extracted and verified document facts (Section 8 of PRD).

### Key Features

1. **Dynamic Fact Visualizations (`apps/web/src/components/visuals/DocumentVisuals.tsx`)**:
   - **Top Allocations Bar Chart**: Ranked quantified allocations and numerical facts directly from document text.
   - **Fiscal Period Breakdown Line Chart**: Multi-period and temporal comparisons with distinctive shape markers (`circle`, `rect`, `triangle`) and line styling for color-blind accessibility.
   - **Category Distribution Treemap**: Thematic and sector weight distribution across extracted civic categories.
   - **Verification Coverage Indicators**: Clear breakdown of verified verbatim quotes vs unverified facts.
2. **Accessible Table Fallbacks (WCAG 2.1 AA)**:
   - Interactive toggle revealing semantic HTML `<table>` representations of all plotted chart marks and citations for screen reader accessibility.
3. **Route-Level Code-Splitting & ECharts Isolation**:
   - Modular imports registered with `echarts/core` (Bar, Line, Treemap, Grid, Tooltip, Legend, CanvasRenderer).
   - `DocumentVisuals` is code-split via `React.lazy()` and `React.Suspense`.
   - ECharts vendor code is isolated into `echarts-vendor.js`, preventing any chart library bloat in the main application entry point.

---

## 2. Chunk Size & Bundle Analysis

### Emitted Production Chunks (`apps/web/dist/assets/`):

| Chunk Name                                    | Minified Size | Gzip Size     | In Initial Entry? |
| :-------------------------------------------- | :------------ | :------------ | :---------------- |
| **`index-*.js`** (App Shell)                  | 161.95 kB     | **42.72 kB**  | YES               |
| **`react-vendor-*.js`** (React, DOM, Router)  | 262.55 kB     | **83.22 kB**  | YES               |
| **`supabase-vendor-*.js`** (Supabase Client)  | 226.69 kB     | **58.78 kB**  | YES               |
| **`DocumentVisuals-*.js`** (Visual Analytics) | 10.06 kB      | **3.39 kB**   | NO (Lazy Loaded)  |
| **`echarts-vendor-*.js`** (ECharts + ZRender) | 1,092.40 kB   | **364.57 kB** | NO (Lazy Loaded)  |
| **`index-*.css`** (Design System Tokens)      | 29.35 kB      | **6.53 kB**   | YES               |

**Verification**:

- Total initial JS payload on home/library page: ~184 kB gzip across all entry chunks.
- ECharts is 100% excluded from initial page loads and only fetched when visual analytics are opened.

---

## 3. Test & Verification Summary

### A. TypeScript Typecheck

```bash
pnpm run typecheck
```

- **Result**: PASSED (0 errors across `packages/shared`, `apps/api`, `apps/web`, and `e2e`).

### B. ESLint

```bash
pnpm run lint
```

- **Result**: PASSED (0 errors, 0 warnings).

### C. Vitest Unit & Integration Suite

```bash
pnpm run test
```

- **Result**: 11/11 test files passed, 56/56 tests passed (including multitenant RLS isolation and document pipeline tests).

### D. Quality Guards & External Host Checks

```bash
pnpm run check:requirements && pnpm run check:fixtures && pnpm run check:forbidden && pnpm run check:tokens && pnpm run check:contrast && pnpm run build && pnpm run check:external-hosts
```

- **Result**: 100% PASSED. Zero unauthorized CDN calls or Google font links. 60/60 WCAG AA contrast checks passed.

### E. Playwright E2E Suite

```bash
pnpm --filter=@juris/e2e test
```

- **Result**: 13/13 tests passed across Chromium instances (Axe accessibility scans, focus traps, keyboard navigation, route transitions, upload validation, and auth).

---

## 4. Side Effects

- Created `apps/web/src/components/visuals/DocumentVisuals.tsx`.
- Updated `apps/web/vite.config.ts` manualChunks to cleanly separate `echarts-vendor`, `supabase-vendor`, and `react-vendor`.
- Added Visual Analytics tab in `apps/web/src/pages/DocumentViewerPage.tsx`.

---

## 5. What Was Not Verified

- Live rendering of multi-gigabyte datasets (charts optimized for standard document extractions with up to 500 facts).
