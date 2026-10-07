/**
 * Pattern A: Dynamic import of echarts barrels with destructuring
 */
export async function loadPatternA() {
  const [
    { use, init, registerTheme },
    { BarChart, LineChart, TreemapChart, HeatmapChart },
    { GridComponent, TooltipComponent, LegendComponent, DatasetComponent, TitleComponent },
    { CanvasRenderer },
  ] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
  ]);

  use([
    BarChart,
    LineChart,
    TreemapChart,
    HeatmapChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    DatasetComponent,
    TitleComponent,
    CanvasRenderer,
  ]);

  return { init, registerTheme };
}
