/**
 * Deep, modular static registration of ECharts in Juris.
 *
 * Imports ONLY the specific chart types, components, and renderers used in product code:
 * - BarChart, LineChart, TreemapChart (via deep install modules)
 * - GridComponent, TooltipComponent, LegendComponent, DatasetComponent, TitleComponent (via deep install modules)
 * - CanvasRenderer (via deep install module)
 *
 * Never imports monolithic 'echarts' or barrel files ('echarts/charts', 'echarts/components').
 */

import { use, init, registerTheme } from 'echarts/core';
import { install as BarChart } from 'echarts/lib/chart/bar/install.js';
import { install as LineChart } from 'echarts/lib/chart/line/install.js';
import { install as TreemapChart } from 'echarts/lib/chart/treemap/install.js';
import { install as GridComponent } from 'echarts/lib/component/grid/install.js';
import { install as TooltipComponent } from 'echarts/lib/component/tooltip/install.js';
import { install as LegendComponent } from 'echarts/lib/component/legend/install.js';
import { install as DatasetComponent } from 'echarts/lib/component/dataset/install.js';
import { install as TitleComponent } from 'echarts/lib/component/title/install.js';
import { install as CanvasRenderer } from 'echarts/lib/renderer/installCanvasRenderer.js';
import { buildEChartsTheme } from './echarts-theme.js';

use([
  BarChart,
  LineChart,
  TreemapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  TitleComponent,
  CanvasRenderer,
]);

registerTheme('juris-light', buildEChartsTheme(false));
registerTheme('juris-dark', buildEChartsTheme(true));

export { init };
