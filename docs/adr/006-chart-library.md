# ADR-006: Chart Library (Spike S5)

- **Status:** Proposed
- **Date:** 2026-10-04

## Context

Juris generates interactive civic visualizations (allocations, budget trends, category share, sunbursts, heatmaps) from verified document facts. The frontend bundle size budget is strictly under 300 KB gzip.

## Question to Answer (Spike S5)

Which chart library fits the bundle budget and interaction requirements?

- **Pass criteria:** Six chart types with cross-filtering rendered from real fixtures within the bundle budget (< 300 KB gzip).
- **Fallback:** Plotly with cherry-picked partial bundles.

## Options Considered

- **Apache ECharts (tree-shaken):** Built-in support for treemap, sunburst, sankey, heatmap, and dark/light theming with modular imports.
- **Plotly.js:** Powerful scientific chart library, larger bundle footprint.
- **Chart.js / Recharts:** Simpler standard charts, but lacks native advanced civic visual types (treemap, sankey).

## Decision

Pending results of Spike S5 (ECharts tree-shaken is the planned default).

## Consequences

Determines charting abstractions in `apps/web/src/components/charts/`.

## Evidence Links

- PRD Section 6 & 11 (Spike S5)
