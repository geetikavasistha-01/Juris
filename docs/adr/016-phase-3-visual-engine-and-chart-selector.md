# ADR-016: Phase 3 Deterministic Chart Selection Engine and Visual Specifications

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** Antigravity AI, Geetika Vasistha
- **Context:** Juris Phase 3 (Visual Engine Foundations & Chart Selector)

---

## 1. Context and Problem Statement

A key vulnerability of LLM-generated analytics dashboards is hallucinated chart data, unsupported visual scales, and visual fabrication. In Juris, as dictated by PRD Section 6.1 and 6.2, the visual engine must be deterministic and code-driven:

- **Code Chooses Charts:** The LLM NEVER writes chart specifications or numeric series values.
- **Strict Provenance Guard (`assertVisualSpecProvenance`):** Zero chart data points may exist without non-empty citations pointing to verified Evidence Graph fact IDs.
- **Declarative Schema (`VisualSpecSchema`):** Standardizes `{ id, kind, title, encodings, series, proofSummary, a11yTable, rank }`.
- **Ranked Multi-Candidate Generation:** Any valid multi-period civic budget excerpt must automatically generate at least 5 distinct visual chart candidates (Headline Strip, Donut/Treemap, Horizontal Ranked Bar, Slope/Line Chart, Grouped Comparison Bar, Bullet Gauge).

---

## 2. Decision Drivers

- **Provenance Integrity (PRD Section 6.2):** Visuals are visual evidence, not decorative art. Any chart item lacking evidence must be structurally rejected.
- **Accessibility Guarantee:** Every visual specification must package an accessible screen-reader table alternative (`a11yTable`).
- **Deterministic Heuristics:** Data volume, categorical cardinality, temporal intervals, and unit homogeneity dictate the exact chart family ranking.

---

## 3. Decisions & Implementation

1. **Declarative Visual Schema (`packages/shared/src/visual-spec.ts`):**
   - Enforces `factIds: z.array(z.string()).min(1)` on every series point.
   - Enforces `proofSummary` computing counts of verified, derived, and computed points.
   - Includes `assertVisualSpecProvenance(spec)` validation.

2. **Deterministic Selection Engine (`packages/shared/src/chart-selector.ts`):**
   - Evaluates unit and currency dominance (`normalizeUnit`, `normalizeCurrency`).
   - Produces up to 6 ranked candidate specs:
     1. `key_figures_strip`: top quantifiable totals.
     2. `donut_pie` (for 2-6 parts) or `treemap` (for >6 parts): proportional breakdown.
     3. `horizontal_ranked_bar`: ordered comparison of top priorities.
     4. `slope_chart` (2 periods) or `line_area` (4+ periods): temporal trajectory.
     5. `grouped_stacked_bar`: structured program category comparison.
     6. `bullet_gauge`: target benchmark metric vs overall allocation.

3. **URL Selection Synchronization (`apps/web/src/lib/selection-store.ts`):**
   - Implements `useVisualSelection` hook binding active category, department, fiscal period, and reading level to browser URL parameters.

---

## 4. Consequences

- Guarantees 100% provenance verification across all generated charts.
- Automatically yields at least 5 distinct candidate visualizations for budget documents.
- Passes all unit and contract tests in `packages/shared/src/visual-spec.test.ts`.
