/**
 * Pattern B: Single module with static named imports from echarts subpackages
 */
import { use, init, registerTheme } from 'echarts/core';
import { BarChart, LineChart, TreemapChart, HeatmapChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DatasetComponent,
  TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

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

export function loadPatternB() {
  return Promise.resolve({ init, registerTheme });
}
