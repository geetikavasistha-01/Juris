# Evidence: Phase 3 Visual Engine Foundations & Chart Selector

- **Slice:** `phase-3-visual-engine`
- **Branch:** `phase-3-visual-engine`
- **Date:** 2026-10-09
- **Status:** Complete & Verified

---

## 1. Overview & Objectives

Phase 3 implements the deterministic chart selection engine and declarative visual specification layer:

1. **Declarative Visual Specification Schema (`packages/shared/src/visual-spec.ts`):**
   - Enforces `VisualSpecSchema` containing `{ id, kind, title, encodings, series, proofSummary, a11yTable, rank }`.
   - Strictly enforces that each series data point has a non-empty `factIds: string[]` citing valid Evidence Graph facts.
   - Guard `assertVisualSpecProvenance` throws `PROVENANCE_VIOLATION` if any unproven series point is passed.
2. **Deterministic Chart Selection Engine (`packages/shared/src/chart-selector.ts`):**
   - Evaluates fact cardinality, dominant unit/currency buckets, and multi-period structures.
   - Automatically generates up to 6 distinct chart candidates:
     1. Headline Figures Strip (`key_figures_strip`)
     2. Donut/Treemap Allocation Breakdown (`donut_pie` / `treemap`)
     3. Horizontal Ranked Program Bar (`horizontal_ranked_bar`)
     4. Fiscal Comparison Slope Chart (`slope_chart` / `line_area`)
     5. Program Allocation Comparison Bar (`grouped_stacked_bar`)
     6. Benchmark Performance Gauge (`bullet_gauge`)
3. **URL Selection Store (`apps/web/src/lib/selection-store.ts`):**
   - Provides URL-synchronized cross-filter hooks for category, department, period, and reading level.

---

## 2. Commands Run and Observed Results

### 1. Visual Spec & Chart Selector Tests (`pnpm --filter=@juris/shared run test src/visual-spec.test.ts`)

```bash
vitest run src/visual-spec.test.ts
```

**Observed Output:**

```text
✓ packages/shared/src/visual-spec.test.ts (3 tests) 16ms
  ✓ validates VisualSpecSchema structure and enforces fact provenance
  ✓ deterministically selects ranked chart candidates based on verified facts (>= 5 candidates verified)
  ✓ rejects unverified or rejected facts from overview visuals
```

### 2. Monorepo Quality Gates (`pnpm lint && pnpm typecheck && pnpm check:contrast && pnpm check:tokens`)

```bash
pnpm lint && pnpm typecheck && pnpm check:contrast && pnpm check:tokens
```

**Observed Output:**

```text
All 120 WCAG AA contrast checks PASSED (100% compliant)
Scanned 44 source files. 100% compliant with design tokens and self-hosted fonts.
Typecheck: 0 errors
Lint: 0 errors, 0 warnings
```

### 3. Full Test Suite (`pnpm test`)

```bash
vitest run
```

**Observed Output:**

```text
Test Files  20 passed (20)
     Tests  133 passed (133)
```

---

## 3. Side Effects (Rule 15)

- **Packages installed:** None.
- **Files touched:**
  - `packages/shared/src/chart-selector.ts`: Added candidates 5 and 6 (`grouped_stacked_bar`, `bullet_gauge`).
  - `packages/shared/src/visual-spec.test.ts`: Added assertions for >= 5 distinct chart candidates.
  - `docs/adr/016-phase-3-visual-engine-and-chart-selector.md`: Added ADR-016.
  - `docs/roadmap.md`: Updated Phase 3 status to COMPLETED.

---

## 4. Not Verified List

- Real browser canvas hardware GPU acceleration in headless CI (mock canvas used for tests; web bundle verified).
