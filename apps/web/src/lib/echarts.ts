/**
 * Modular ECharts loader for Juris
 *
 * Imports ONLY the specific chart types, components, and renderers used in product code:
 * - BarChart, LineChart (via deep install modules)
 * - GridComponent, TooltipComponent, LegendComponent, DatasetComponent, TitleComponent (via deep install modules)
 * - CanvasRenderer (via deep install module)
 *
 * Never imports monolithic 'echarts' or barrel files.
 */

import { use, init, registerTheme, type ECharts } from 'echarts/core';
import { install as BarChart } from 'echarts/lib/chart/bar/install.js';
import { install as LineChart } from 'echarts/lib/chart/line/install.js';
import { install as GridComponent } from 'echarts/lib/component/grid/install.js';
import { install as TooltipComponent } from 'echarts/lib/component/tooltip/install.js';
import { install as LegendComponent } from 'echarts/lib/component/legend/install.js';
import { install as DatasetComponent } from 'echarts/lib/component/dataset/install.js';
import { install as TitleComponent } from 'echarts/lib/component/title/install.js';
import { install as CanvasRenderer } from 'echarts/lib/renderer/installCanvasRenderer.js';
import { buildEChartsTheme } from './echarts-theme.js';

let initialized = false;

export async function loadJurisECharts(): Promise<{ init: typeof init }> {
  if (!initialized) {
    use([
      BarChart,
      LineChart,
      GridComponent,
      TooltipComponent,
      LegendComponent,
      DatasetComponent,
      TitleComponent,
      CanvasRenderer,
    ]);

    registerTheme('juris-light', buildEChartsTheme(false));
    registerTheme('juris-dark', buildEChartsTheme(true));
    initialized = true;
  }
  return { init };
}

export { init };
export type { ECharts };
