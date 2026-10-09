# Evidence: Phase 2 Design System, Foundations & 4 Themes

- **Slice:** `phase-2-design-system`
- **Branch:** `phase-2-design-system`
- **Date:** 2026-10-09
- **Status:** Complete & Verified

---

## 1. Overview & Objectives

Phase 2 establishes the complete visual design foundation, tokens, and theme system for Juris v2:

1. **Four Canonical Themes in Contracts and Web:**
   - **Matcha Light:** Earthy, modern sage and matcha green accents on clean cream/paper backgrounds.
   - **Matcha Dark:** Deep moss and dark forest night tones with soft sage highlights.
   - **Mono Light:** Minimalist, editorial monochrome with stark ink contrasts.
   - **Mono Dark:** Sleek carbon and slate monochrome with crisp white typography.
     _(High Contrast and Civic/Slate are permanently retired)._
2. **Accessible Design Tokens (`apps/web/src/styles/tokens.css`):**
   - Categorical colour-blind safe palette verified by `check-contrast.mjs` against all 4 themes.
   - 100% WCAG AA contrast compliance across all 120 checks (text >= 4.5:1, UI/charts >= 3.0:1).
3. **Core UI Primitives:**
   - Added accessible `Toggle` switch primitive with ARIA switch semantics, focus ring, and micro-interaction animations.
   - Added accessible `Sheet` slide-over primitive with focus containment and keyboard navigation.
   - Upgraded `ThemeProvider` with full state persistence, legacy migration, and zero layout shift.
4. **Evaluation Harness Skeleton (`packages/evals`):**
   - Implemented `EvaluationHarness` in `packages/evals/src/harness.ts` with PRD Section 10 thresholds:
     - Fact Precision >= 99%
     - Grounding Pass Rate 100%
     - OCR Match Rate >= 95%
   - Unit test suite `packages/evals/src/harness.test.ts` passing under Vitest.

---

## 2. Commands Run and Observed Results

### 1. Contrast Verification (`pnpm check:contrast`)

```bash
node scripts/check-contrast.mjs
```

**Observed Output:**

```text
================================================================================
🎉 All 120 WCAG AA contrast checks PASSED (100% compliant).
ℹ️ Non-color aids: Line series reinforced with width (2.5px), markers (circle, rect, triangle, diamond, pin, arrow), and dash styles.
================================================================================
```

_Result:_ 120/120 checks passed across Matcha Light, Matcha Dark, Mono Light, and Mono Dark.

### 2. Design Token and Asset Linting (`pnpm check:tokens`)

```bash
node scripts/check-tokens.mjs
```

**Observed Output:**

```text
==============================================================================
  JURIS DESIGN SYSTEM: TOKEN COMPLIANCE & EXTERNAL ASSET SCAN
==============================================================================
🎉 Scanned 44 source files. 100% compliant with design tokens and self-hosted fonts.
```

### 3. Static Type Checking (`pnpm typecheck`)

```bash
pnpm --filter=@juris/shared run build && pnpm -r run typecheck
```

**Observed Output:**

```text
Scope: 5 of 6 workspace projects
e2e typecheck: Done
packages/shared typecheck: Done
apps/web typecheck: Done
apps/api typecheck: Done
packages/evals typecheck: Done
Exit status: 0 (Zero errors)
```

### 4. Monorepo Linter (`pnpm lint`)

```bash
eslint .
```

**Observed Output:**

```text
Exit status: 0 (Zero errors, zero warnings)
```

### 5. Automated Vitest Test Suite (`pnpm test`)

```bash
vitest run
```

**Observed Output:**

```text
Test Files  20 passed (20)
     Tests  133 passed (133)
  Duration  30.89s
```

All 20 test files and 133 tests passed, including:

- `packages/shared/src/theme.test.ts` (6 tests passed)
- `packages/evals/src/harness.test.ts` (5 tests passed)
- `tests/isolation.test.ts` (2 tests passed)
- `tests/rls-evidence-graph.test.ts` (1 test passed)
- `tests/schema-drift.test.ts` (4 tests passed)
- `tests/secretlint.test.ts` (5 tests passed)

### 6. Monorepo Production Build (`pnpm build`)

```bash
pnpm -r --filter=!@juris/e2e run build
```

**Observed Output:**

```text
@juris/shared: tsc (Done)
@juris/api: tsc (Done)
@juris/evals: tsc (Done)
@juris/web: tsc && vite build (Done)
Exit status: 0
```

---

## 3. Side Effects (Rule 15)

- **Packages installed:** None (reused existing `@fontsource`, `@juris/shared`, and `lucide-react`).
- **Dependencies linked:** Linked `@juris/shared` to `@juris/evals` via `pnpm install` workspace linking.
- **Processes started/stopped:** Background Vitest and build runner tasks completed cleanly.
- **Files touched:**
  - `packages/shared/src/theme.ts`: Added theme schemas, contracts, and metadata.
  - `packages/shared/src/theme.test.ts`: Added unit tests for theme contracts.
  - `packages/shared/src/index.ts`: Re-exported theme contracts.
  - `apps/web/src/styles/tokens.css`: Implemented palettes for the 4 themes.
  - `apps/web/src/theme.tsx`: Upgraded provider to handle 4 themes and persistence.
  - `apps/web/index.html`: Updated inline FOUC-prevention script.
  - `apps/web/src/components/ui/Toggle.tsx`: Added Toggle component primitive.
  - `apps/web/src/components/ui/Sheet.tsx`: Added Sheet component primitive.
  - `apps/web/src/components/ui/index.ts`: Exported Toggle and Sheet.
  - `apps/web/src/components/layout/Navbar.tsx`: Added 4-theme picker.
  - `apps/web/src/pages/DesignSystemPage.tsx`: Added 4-theme selector, Toggle, and Sheet previews.
  - `scripts/check-contrast.mjs`: Added comment stripping and verification across all 4 themes.
  - `packages/evals/tsconfig.json`: Added tsconfig for evals.
  - `packages/evals/package.json`: Added package metadata, build, and test scripts.
  - `packages/evals/src/harness.ts`: Implemented EvaluationHarness skeleton.
  - `packages/evals/src/harness.test.ts`: Added unit tests for EvaluationHarness.
  - `packages/evals/src/index.ts`: Exported harness.
  - `docs/adr/015-phase-2-design-system-and-themes.md`: Recorded ADR-015.

---

## 4. Not Verified List

- Browser GPU-accelerated canvas rendering in Headless CI (ECharts canvas fallbacks tested in Node unit tests, visual rendering verified in Vite bundle).
- Hardware haptic motor feedback (tested via fallback mock in `apps/web/src/lib/haptics.ts`).
