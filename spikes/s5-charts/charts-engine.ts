import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart, LineChart, SunburstChart, TreemapChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { RealBudgetData } from './budget-data.js';

// Tree-shaken registration
echarts.use([
  TreemapChart,
  BarChart,
  LineChart,
  SunburstChart,
  HeatmapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  VisualMapComponent,
  ToolboxComponent,
  CanvasRenderer,
]);

export interface ChartRegistry {
  treemap: echarts.ECharts;
  bar: echarts.ECharts;
  line: echarts.ECharts;
  sunburst: echarts.ECharts;
  heatmap: echarts.ECharts;
}

export function initCivicCharts(
  containerIds: {
    treemap: string;
    bar: string;
    line: string;
    sunburst: string;
    heatmap: string;
  },
  data: RealBudgetData,
  onSelectCategory: (category: string, amount: number, page: number) => void,
): ChartRegistry {
  // 1. Treemap: Allocation by Category
  const treemapDom = document.getElementById(containerIds.treemap)!;
  const treemapChart = echarts.init(treemapDom);
  treemapChart.setOption({
    title: {
      text: 'Allocation by Sector (₹ Crore)',
      left: 'center',
      textStyle: { color: '#f8fafc', fontSize: 14 },
    },
    tooltip: {
      formatter: (info: { value?: unknown; name?: string; data?: { sourcePage?: number } }) => {
        const val = Number(info.value || 0);
        const name = info.name || '';
        const page = info.data?.sourcePage ? ` (Page ${info.data.sourcePage})` : '';
        return `<strong>${name}</strong>${page}<br/>₹${val.toLocaleString()} Crore`;
      },
    },
    series: [
      {
        type: 'treemap',
        visibleMin: 300,
        label: { show: true, formatter: '{b}\n₹{c} Cr' },
        itemStyle: { borderColor: '#1e293b' },
        levels: [
          {
            itemStyle: {
              colorMappingBy: 'value',
              gapWidth: 2,
            },
          },
        ],
        data: data.allocations.map((a) => ({
          name: a.category,
          value: a.amountCrores,
          sourcePage: a.sourcePage,
        })),
      },
    ],
  });

  // Cross-filtering on Treemap click
  treemapChart.on(
    'click',
    (params: { data?: { name?: string; value?: number; sourcePage?: number } }) => {
      if (params.data && params.data.name && params.data.value !== undefined) {
        onSelectCategory(params.data.name, params.data.value, params.data.sourcePage || 1);
      }
    },
  );

  // 2. Bar Chart: Capital vs Revenue Expenditure
  const barDom = document.getElementById(containerIds.bar)!;
  const barChart = echarts.init(barDom);
  barChart.setOption({
    title: {
      text: 'Capital vs Revenue Split (₹ Crore)',
      left: 'center',
      textStyle: { color: '#f8fafc', fontSize: 14 },
    },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: ['Capital Expenditure', 'Revenue Expenditure'],
      axisLabel: { color: '#94a3b8' },
    },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: '₹{value}' } },
    series: [
      {
        type: 'bar',
        data: [
          { value: data.capitalExpenditure, itemStyle: { color: '#0ea5e9' } },
          { value: data.revenueExpenditure, itemStyle: { color: '#10b981' } },
        ],
        barWidth: '40%',
      },
    ],
  });

  // 3. Line Chart: 5-Year Budget Trend
  const lineDom = document.getElementById(containerIds.line)!;
  const lineChart = echarts.init(lineDom);
  lineChart.setOption({
    title: {
      text: 'Expenditure Trajectory (5 Years)',
      left: 'center',
      textStyle: { color: '#f8fafc', fontSize: 14 },
    },
    tooltip: { trigger: 'axis' },
    legend: { data: ['Total', 'Capital', 'Revenue'], top: 25, textStyle: { color: '#94a3b8' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.trends.map((t) => t.year),
      axisLabel: { color: '#94a3b8' },
    },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8' } },
    series: [
      {
        name: 'Total',
        type: 'line',
        data: data.trends.map((t) => t.totalExpenditure),
        smooth: true,
        itemStyle: { color: '#f59e0b' },
      },
      {
        name: 'Capital',
        type: 'line',
        data: data.trends.map((t) => t.capitalExpenditure),
        smooth: true,
        itemStyle: { color: '#0ea5e9' },
      },
      {
        name: 'Revenue',
        type: 'line',
        data: data.trends.map((t) => t.revenueExpenditure),
        smooth: true,
        itemStyle: { color: '#10b981' },
      },
    ],
  });

  // 4. Sunburst: Hierarchical Department Breakdown
  const sunburstDom = document.getElementById(containerIds.sunburst)!;
  const sunburstChart = echarts.init(sunburstDom);
  sunburstChart.setOption({
    title: {
      text: 'Hierarchical Structure',
      left: 'center',
      textStyle: { color: '#f8fafc', fontSize: 14 },
    },
    tooltip: { trigger: 'item' },
    series: {
      type: 'sunburst',
      data: data.hierarchy.children,
      radius: [0, '85%'],
      label: { rotate: 'radial', color: '#ffffff' },
      itemStyle: { borderRadius: 4, borderWidth: 2 },
    },
  });

  // 5. Heatmap: Sector Priorities Matrix
  const heatmapDom = document.getElementById(containerIds.heatmap)!;
  const heatmapChart = echarts.init(heatmapDom);
  const sectors = ['Infra', 'Health', 'Agri', 'Energy'];
  const dimensions = ['Capital Intensity', 'Job Creation', 'Green Transition'];
  const heatmapData = data.priorityMatrix.map((item) => [
    sectors.indexOf(item.sector),
    dimensions.indexOf(item.dimension),
    item.score,
  ]);

  heatmapChart.setOption({
    title: {
      text: 'Sector Priority Assessment',
      left: 'center',
      textStyle: { color: '#f8fafc', fontSize: 14 },
    },
    tooltip: { position: 'top' },
    grid: { height: '50%', top: '20%' },
    xAxis: {
      type: 'category',
      data: sectors,
      splitArea: { show: true },
      axisLabel: { color: '#94a3b8' },
    },
    yAxis: {
      type: 'category',
      data: dimensions,
      splitArea: { show: true },
      axisLabel: { color: '#94a3b8' },
    },
    visualMap: {
      min: 0,
      max: 100,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '5%',
      textStyle: { color: '#94a3b8' },
      inRange: { color: ['#1e293b', '#0284c7', '#38bdf8'] },
    },
    series: [
      {
        name: 'Score',
        type: 'heatmap',
        data: heatmapData,
        label: { show: true, color: '#ffffff' },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
      },
    ],
  });

  // Handle auto-resize
  window.addEventListener('resize', () => {
    treemapChart.resize();
    barChart.resize();
    lineChart.resize();
    sunburstChart.resize();
    heatmapChart.resize();
  });

  return {
    treemap: treemapChart,
    bar: barChart,
    line: lineChart,
    sunburst: sunburstChart,
    heatmap: heatmapChart,
  };
}
