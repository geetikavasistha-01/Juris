/**
 * Modular ECharts loader for Juris
 *
 * Imports ONLY registered chart types and components from 'echarts/core',
 * 'echarts/charts', 'echarts/components', and 'echarts/renderers'.
 * Never imports the monolithic 'echarts' bundle.
 */

import { buildEChartsTheme } from './echarts-theme.js';
import type { init as initFn } from 'echarts/core';

let initializedPromise: Promise<{
  init: typeof initFn;
}> | null = null;

export function loadJurisECharts() {
  if (!initializedPromise) {
    initializedPromise = Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers'),
    ]).then(
      ([
        { use, init, registerTheme },
        { BarChart, LineChart, TreemapChart, HeatmapChart },
        { GridComponent, TooltipComponent, LegendComponent, DatasetComponent, TitleComponent },
        { CanvasRenderer },
      ]) => {
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

        registerTheme('juris-light', buildEChartsTheme(false));
        registerTheme('juris-dark', buildEChartsTheme(true));

        return { init };
      },
    );
  }
  return initializedPromise;
}
