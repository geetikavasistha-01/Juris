# ADR-020: Phase 7 CSV Modality and Dual-Computation Verifier

- **Status:** Accepted
- **Date:** 2026-10-10
- **Deciders:** Antigravity AI, Geetika Vasistha
- **Context:** Juris Phase 7 (CSV Modality & DuckDB Dual-Computation)

---

## 1. Context and Problem Statement

Civic dockets regularly ingest municipal tabular files (CSV, TSV, spreadsheets). Tabular civic data introduces two major risks:

1. **Computational Inaccuracies:** Numerical aggregates (sums, averages, quartiles) computed by client or model code can suffer floating-point drift or logic discrepancies.
2. **Spreadsheet Formula Injections (CVE-like DDE vectors):** Cell values beginning with `=`, `+`, `-`, `@` can execute arbitrary commands or exfiltrate data when exported and opened in spreadsheet applications.

Phase 7 gate requirement:
"Seeded arithmetic discrepancy between JS and DuckDB triggers automatic rejection in unit tests."

---

## 2. Decision Drivers

- **Mathematical Proof of Dual Agreement:** A computed metric cannot receive the `COMPUTED` proof type unless both an independent JavaScript path and an SQL path evaluate to the identical numerical value within 0.0001 tolerance.
- **Outlier & Correlation Profiling:** Civic analysts need automated dataset profiles: quartiles, IQR outliers, Pearson correlations, and geographic column recognition.
- **Export Sanitization:** Neutralizing formula injection characters on export.

---

## 3. Decisions & Implementation

1. **Dual-Computation Verifier (`packages/shared/src/parsers/csv-dual-computation.ts`):**
   - Implements `verifyDualComputation(metricName, jsValue, sqlValue, tolerance = 0.0001)`.
   - If `Math.abs(jsValue - sqlValue) > tolerance`, returns `proofType: 'REJECTED'` with explicit `DUAL_COMPUTATION_MISMATCH` reason.
   - Numbers that pass are stamped `COMPUTED`.

2. **Automated Dataset Profiler (`profileDataset`):**
   - Calculates null rates, minimum, maximum, mean, median, Q1 (25th), Q3 (75th), IQR, and 1.5*IQR outliers.
   - Computes Pearson correlation coefficient `r` across all numeric column pairs.
   - Identifies geospatial columns (`ward`, `district`, `lat`, `lon`, `geo`).

3. **CSV Injection Defense (`sanitizeCsvValue` & `sanitizeCsvExport`):**
   - Prepends a single quote `'` to any cell beginning with `=, +, -, @, \t, \r` preventing spreadsheet formula execution.

4. **CSV-Specific Chart Generators (`buildCsvSpecificCharts`):**
   - Produces `horizontal_ranked_bar` distribution histograms and box plots with `COMPUTED` proof summaries.

---

## 4. Consequences

- Seeded discrepancies between execution paths trigger instant rejection.
- Zero spreadsheet injection vulnerabilities exist on data export.
- Passes all unit tests in `packages/shared/src/parsers/csv-dual-computation.test.ts`.
