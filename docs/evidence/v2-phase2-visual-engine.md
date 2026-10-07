# Evidence: Juris v2 Phase 2 — Declarative Visual Engine, Deterministic Chart Selector & Storyboard

**Date**: 2026-10-08  
**Phase**: Phase 2 — Declarative Visual Engine & Overview Storyboard  
**Status**: Gate Passed ✅

---

## 1. Summary of Changes

1. **`packages/shared/src/visual-spec.ts`**:
   - Defined `VisualSpecSchema`, `VisualSeriesSchema`, and `VisualSeriesPointSchema`.
   - Implemented strict mechanical validator `assertVisualSpecProvenance()` ensuring 100% point-to-fact traceability (`factIds` linking each series point to a verified fact).
   - Added `isEstimated` flagging and metadata fields.
2. **`packages/shared/src/chart-selector.ts`**:
   - Implemented deterministic chart selector `selectVisualSpecs()`.
   - Generates candidate chart specifications based on fact counts and categorization (e.g. allocation breakdowns into horizontal bars, trend points into line series, and key figure totals).
3. **`scripts/check-visual-specs.mjs` & package.json script `"check:visual-specs"`**:
   - Implemented automated repo guard checking visual specifications against provenance rules.
4. **`apps/web/src/lib/selection-store.ts`**:
   - Implemented cross-filtering Zustand store synced bi-directionally with browser URL search parameters (`?category=...&point=...&includeEstimates=...`).
5. **`apps/web/src/lib/echarts-theme.ts`**:
   - Extracted theme color tokens under `ECHARTS_COLORS` to comply with the token guard and WCAG AA contrast matrix.
6. **`apps/web/src/components/visuals/ProofBadge.tsx`**:
   - Proof badge component rendering color-coded, accessible indicators for all 9 proof types (`VERIFIED`, `VERIFIED_OCR`, `COMPUTED`, `DERIVED`, `USER_CONFIRMED`, `ESTIMATED`, `CONFLICT`, `REJECTED`, `UNVERIFIABLE`).
7. **`apps/web/src/components/visuals/VisualCard.tsx`**:
   - Declarative ECharts visualization card with interactive tooltips, cross-filtering, fact citation drawer trigger, and toggleable accessible data tables (`role="table"`).
8. **`apps/web/src/components/visuals/OverviewStoryboard.tsx`**:
   - "Document at a Glance" storyboard displaying header stats (verification rate, verified facts count, page count), 1-minute layman synopsis, and declarative chart flow.
9. **`apps/web/src/pages/DocumentViewerPage.tsx`**:
   - Integrated `OverviewStoryboard` as the default active tab on document viewer page.

---

## 2. Verification Commands & Observed Results

### A. Unit & Contract Verification Suite

```bash
pnpm test
```

**Output**:

- 14 test files passed (14/14)
- 94 tests passed (94/94), including all `visual-spec.test.ts` provenance test cases.

### B. Fixtures & Visual Spec Guards

```bash
pnpm check:fixtures && pnpm check:fixtures -- --test-negative
pnpm check:visual-specs
```

**Output**:

- `check:fixtures`: Verified all positive and negative fixture invariants.
- `check:visual-specs`: 100% compliance across all scanned visual specifications.

### C. Design System & Accessibility Guards

```bash
pnpm check:tokens && pnpm check:contrast
```

**Output**:

- `check:tokens`: 0 forbidden ad-hoc styles found.
- `check:contrast`: All 60 WCAG AA contrast checks passed across light, dark, and vision-impaired color simulations.

### D. Repository Guards & Hygiene

```bash
pnpm check:external-hosts && pnpm check:forbidden && pnpm check:requirements
pnpm scan:secrets
```

**Output**:

- 0 unauthorized external hosts (fonts/assets 100% self-hosted).
- 0 forbidden words in product source files.
- 0 secret violations detected via `secretlint`.

### E. Typecheck & Lint

```bash
pnpm typecheck && pnpm lint
```

**Output**:

- All 5 workspace projects passed TypeScript compilation with zero errors.
- ESLint passed with 0 errors and 0 warnings.

### F. Build & Bundle Budget Guard

```bash
pnpm build && pnpm check:bundle
```

**Output**:

- Initial JS Gzip: 207.59 KB (Budget: 300 KB) ✅
- Lazy JS Gzip: 178.64 KB ✅
- CSS Gzip: 7.08 KB ✅

### G. Full Playwright E2E Verification Suites

```bash
pnpm run e2e e2e/ui-states/
pnpm run e2e e2e/real/ --workers=1
```

**Output**:

- `e2e/ui-states/`: 7/7 tests passed (keyboard navigation, focus trap, dropzone, navigation).
- `e2e/real/`: 16/16 tests passed:
  - 13 Axe Core WCAG 2.1 AA scans across Desktop/Mobile and Light/Dark modes (including real Facts tab and Overview & Visuals tab).
  - Cross-tenant isolation verification (`isolation.spec.ts`).
  - WebSocket drop and polling fallback recovery (`socket-drop.spec.ts`).
  - Real 18-page PDF excerpt upload, worker extraction, DB insertion, and UI inspection (`upload-flow.spec.ts`).

---

## 3. Side Effects

- Added `"check:visual-specs"` script to root `package.json`.
- Modified `vitest.config.ts` (`fileParallelism: false`, `testTimeout: 20000`) for deterministic test execution against local Postgres.
- Configured ECharts theme and selection stores in `@juris/web`.

---

## 4. Not Verified / Next Phase (Phase 3)

- Phase 3 will introduce the Insight Engine (deterministic insight template generator), Grounding Verifier (lexical overlap & span citation checks for summary claims), and progressive tactile haptics.
