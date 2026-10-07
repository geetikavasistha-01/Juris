# ADR-012: Revised Lazy Chart Chunk Budget for Modular ECharts

- **Status:** PROPOSED
- **Date:** 2026-10-07
- **Deciders:** Human Reviewer, Engineering Agent

## Context

Juris renders interactive, verified civic visualizations (Top Quantitative Allocations Bar Chart and Temporal Trend Line Chart) from structured document facts.

Under ADR-006 (Spike S5), the initial app shell budget was established at `< 300 KB gzip` and a provisional lazy-loaded chart chunk budget was set at `< 120 KB gzip`.

Following deep modular registration in `apps/web/src/lib/echarts-setup.ts` and the complete removal of the monolithic TreemapChart component, ECharts was measured with `vite build` using the Rollup Chunk Analyzer and Gzip compression:

1. **Initial JS Shell (`index-[hash].js`):** **195.83 KB gzip** (Well under the 300 KB budget, **PASS**).
2. **Lazy Component Shell (`DocumentVisuals-[hash].js`):** **4.24 KB gzip** (React components + lucide-react icons, **PASS**).
3. **Lazy Modular ECharts Chunk (`echarts-setup-[hash].js`):** **179.07 KB gzip** (527.77 KB raw uncompressed).

Against the provisional `< 120 KB` target, the status remains **FAIL / IN REVIEW**.

## Measured Per-Module Breakdown (Top 15 Modules by Rendered Length)

```text
 1. echarts/lib/core/echarts.js                        :  61.75 KB (4.3%)
 2. echarts/lib/chart/line/LineView.js                 :  33.55 KB (2.3%)
 3. echarts/lib/component/tooltip/TooltipView.js       :  31.71 KB (2.2%)
 4. echarts/lib/component/axis/AxisBuilder.js          :  31.50 KB (2.2%)
 5. zrender/lib/Element.js                             :  31.42 KB (2.2%)
 6. echarts/lib/chart/bar/BarView.js                   :  27.74 KB (1.9%)
 7. echarts/lib/data/DataStore.js                      :  26.04 KB (1.8%)
 8. zrender/lib/animation/Animator.js                  :  24.67 KB (1.7%)
 9. zrender/lib/core/PathProxy.js                      :  24.12 KB (1.7%)
10. echarts/lib/data/SeriesData.js                     :  23.17 KB (1.6%)
11. zrender/lib/canvas/Painter.js                      :  22.48 KB (1.6%)
12. zrender/lib/graphic/helper/parseText.js            :  20.83 KB (1.5%)
13. echarts/lib/coord/cartesian/Grid.js                :  20.08 KB (1.4%)
14. zrender/lib/graphic/Text.js                        :  19.04 KB (1.3%)
15. zrender/lib/canvas/graphic.js                      :  18.17 KB (1.3%)
```

## Proposal

Revise the lazy-loaded chart chunk budget from `< 120 KB gzip` to `< 190 KB gzip` (measured 179.07 KB gzip with a 10 KB safety margin), subject to the following guarantees:

1. **Zero Impact on Initial Load:** `echarts-setup` is strictly isolated behind `loadJurisECharts()` dynamic import and is never bundled into `index.html` or the initial application bundle.
2. **Guaranteed App Shell Budget:** `check:bundle` in CI will continue to fail if total initial JS gzip exceeds 300 KB.
3. **Accessible Fallback:** Full WCAG AA tabular fallback is always rendered immediately without requiring ECharts to load.

## Consequences

- **If Approved:** The lazy ECharts bundle target is updated to 190 KB gzip in CI configuration, enabling clean, maintainable, modular charting.
- **If Rejected:** Engineering will either adopt custom SVG micro-charts (<15 KB gzip) or implement fine-grained dynamic sub-chunking per visual series.
