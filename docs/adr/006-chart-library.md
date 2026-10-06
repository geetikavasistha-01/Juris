# ADR-006: Chart Library (Spike S5)

- **Status:** In Review (Partial: FAILED <120 KB lazy chunk target)
- **Date:** 2026-10-06

## Context

Juris generates interactive civic visualizations (allocations, budget trends, category share, sunbursts, heatmaps) from verified document facts. The frontend initial bundle budget is strictly under 300 KB gzip, and the approved plan set a target for the lazy-loaded chart chunk under 120 KB gzip.

## Question to Answer (Spike S5)

Which chart library fits the bundle budget and interaction requirements?

- **Initial App Budget:** Initial JS < 300 KB gzip.
- **Lazy Chart Chunk Budget:** Lazy chunk < 120 KB gzip.
- **Visuals Required:** Six chart types with interactive cross-filtering rendered from real fixtures.

## Measured Metrics (Production Vite Build with Gzip Compression)

- **Initial JS Bundle (Demo):** 2.55 KB gzip (Demo test bench).
- **Projected Full App Initial Bundle:** ~85–110 KB gzip (React + React Router + TanStack Query + Supabase client). Well within the `< 300 KB` PRD Section 10a budget.
- **Lazy-Loaded Combined Charts Chunk:** **222.16 KB gzip** (**FAILED** against the approved `< 120 KB` target when all 6 chart types are imported together).
- **Interactions:** Playwright verified canvas rendering, tooltip display, and bidirectional cross-filtering without layout shift.

## Proposed Remediation Options (Pending Human Approval)

1. **Option A (Route-Based Sub-Chunk Splitting - Recommended):** Rather than bundling all 6 ECharts series (`Bar`, `Line`, `Treemap`, `Sunburst`, `Heatmap`) into one monolithic 222 KB chunk, split them dynamically:
   - Base ECharts Core + Canvas Renderer: ~80 KB gzip
   - Individual Chart Series: ~20–45 KB gzip each on demand per route
   - Result: No individual route chunk exceeds 120 KB gzip.
2. **Option B (Hybrid Micro-Charts):** Use lightweight SVG/HTML bars/strips for simple allocation meters (<10 KB) and lazy-load ECharts only for Treemaps and Sunbursts.
3. **Option C (Adjust Target Threshold):** Formally approve the 222 KB lazy chunk since it is loaded asynchronously and never blocks initial page render or PDF viewing.

## Evidence Links

- PRD Section 6 & 11 (Spike S5)
- `spikes/s5-charts/results.json`
- `docs/evidence/phase-1-spikes.md`
