# ADR-006: Chart Library (Spike S5)

- **Status:** Accepted
- **Date:** 2026-10-06

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

**Adopt Apache ECharts (tree-shaken)** with on-demand dynamic chunk lazy loading.

In Spike S5, modular tree-shaken ECharts was evaluated with real budget figures extracted from `budget-speech-2026-27-english.pdf`. Six civic visualization types were rendered (Key Figures Strip, Sector Treemap, CapEx vs RevEx Bar, 5-Year Trend Line, Department Sunburst, and Priority Heatmap).

**Measured Metrics (Production Vite Build with Gzip Compression):**

- **Initial JS Bundle:** 2.55 KB gzip (Pass: well within the `< 300 KB` PRD Section 10a budget).
- **Lazy-Loaded Charts Chunk:** 222.16 KB gzip (loaded only when rendering dashboard views).
- **Interactions:** Playwright verified canvas rendering, tooltip display, and bidirectional cross-filtering without layout shift.

## Consequences

- Frontend chart abstractions will be built in `apps/web` using tree-shaken ECharts modules.
- Initial page load and document reading remain ultra-lightweight.

## Evidence Links

- PRD Section 6 & 11 (Spike S5)
- `spikes/s5-charts/results.json`
