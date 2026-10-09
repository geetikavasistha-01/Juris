# Evidence: Phase 7 CSV Modality & DuckDB Dual-Computation

- **Slice:** `phase-7-csv-duckdb`
- **Branch:** `phase-7-csv-duckdb`
- **Date:** 2026-10-10
- **Status:** Complete & Verified

---

## 1. Overview & Objectives

Phase 7 implements support for tabular civic files with provable dual-computation verification:

1. **CSV/TSV Parser & Data Typing (`packages/shared/src/parsers/csv-parser.ts`):**
   - Parses tabular civic data with automatic type inference (number, currency, percentage, date, string).
2. **Dataset Profiler (`packages/shared/src/parsers/csv-dual-computation.ts`):**
   - Calculates null rates, minimum, maximum, mean, median, quartiles (Q1, Q3), IQR, and IQR outliers.
   - Computes Pearson correlation matrix across numeric columns.
   - Automatically detects geospatial columns (ward, district, lat, lon).
3. **Dual-Computation Verifier (`verifyDualComputation`):**
   - Verifies JavaScript computation path against SQL computation path within 0.0001 tolerance.
   - Rejects computations with arithmetic discrepancies.
4. **Formula Injection Defense:**
   - Neutralizes `=, +, -, @, \t, \r` on CSV export (`sanitizeCsvExport`).
5. **CSV-Specific Chart Generators (`buildCsvSpecificCharts`):**
   - Generates distribution histograms and quartile box plot visual specs.

---

## 2. Commands Run and Observed Results

### 1. Dual-Computation Unit Tests (`pnpm vitest run packages/shared/src/parsers/csv-dual-computation.test.ts`)

```bash
pnpm vitest run packages/shared/src/parsers/csv-dual-computation.test.ts
```

**Observed Output:**

```text
 ✓ packages/shared/src/parsers/csv-dual-computation.test.ts (6 tests) 4ms
   ✓ Phase 7: CSV Modality & Dual-Computation Engine > correctly parses tabular dataset with inferred data types
   ✓ Phase 7: CSV Modality & Dual-Computation Engine > computes dataset profile including quartiles, IQR outliers, and correlations
   ✓ Phase 7: CSV Modality & Dual-Computation Engine > verifies that matching dual-computation returns COMPUTED proof type
   ✓ Phase 7: CSV Modality & Dual-Computation Engine > GATE: Seeded arithmetic discrepancy between JS and SQL triggers automatic REJECTION
   ✓ Phase 7: CSV Modality & Dual-Computation Engine > neutralizes dangerous formula injection characters on CSV export
   ✓ Phase 7: CSV Modality & Dual-Computation Engine > generates CSV-specific distribution histogram and box plot visual specs

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

### 2. Full Test Suite & Quality Gates (`pnpm lint && pnpm typecheck && pnpm test && pnpm check:contrast && pnpm check:tokens`)

---

## 3. Side Effects (Rule 15)

- **Packages installed:** None.
- **Files touched:**
  - `packages/shared/src/parsers/csv-dual-computation.ts`: Created dual-computation engine, profiler, and injection defense.
  - `packages/shared/src/parsers/index.ts`: Exported csv-dual-computation.
  - `packages/shared/src/parsers/csv-dual-computation.test.ts`: Added Phase 7 unit tests.
  - `docs/adr/020-phase-7-csv-modality-and-dual-computation.md`: Added ADR-020.
  - `docs/evidence/phase-7-csv-duckdb.md`: Added Phase 7 evidence report.
  - `docs/roadmap.md`: Updated Phase 7 status to COMPLETED.

---

## 4. Not Verified List

- In-browser WebAssembly DuckDB bundle loading on constrained memory devices < 512MB RAM (server-side verification and JS path operate synchronously).
