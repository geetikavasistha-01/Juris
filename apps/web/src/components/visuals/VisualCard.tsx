import React, { useEffect, useRef, useState } from 'react';
import type { VisualSpec, VisualSeriesPoint } from '@juris/shared';
import { loadJurisECharts } from '../../lib/echarts.js';
import { ECHARTS_COLORS } from '../../lib/echarts-theme.js';
import { useTheme } from '../../theme.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '../ui/index.js';
import { ProofBadge } from './ProofBadge.js';
import { Table as TableIcon, BarChart2, Eye, Sparkles } from 'lucide-react';
import type { init as initFn } from 'echarts/core';

type EChartsInstance = ReturnType<typeof initFn>;

interface VisualCardProps {
  spec: VisualSpec;
  onSelectPoint?: (point: VisualSeriesPoint) => void;
  onOpenInsight?: (spec: VisualSpec) => void;
  className?: string;
}

export const VisualCard: React.FC<VisualCardProps> = ({
  spec,
  onSelectPoint,
  onOpenInsight,
  className = '',
}) => {
  const { isDark } = useTheme();
  const [showTable, setShowTable] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<EChartsInstance | null>(null);

  useEffect(() => {
    if (!chartRef.current || spec.kind === 'key_figures_strip') return;

    let isDisposed = false;

    loadJurisECharts().then(({ init }) => {
      if (isDisposed || !chartRef.current) return;

      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
      }

      const themeName = isDark ? 'juris-dark' : 'juris-light';
      const chart = init(chartRef.current, themeName, { renderer: 'canvas' });
      chartInstanceRef.current = chart;

      const baseOption = buildEChartsOption(spec, isDark);
      chart.setOption(baseOption, true);

      // Handle element click interaction
      chart.off('click');
      chart.on('click', (params) => {
        const point = spec.series[params.dataIndex];
        if (point && onSelectPoint) {
          onSelectPoint(point);
        }
      });

      const handleResize = () => chart.resize();
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.dispose();
      };
    });

    return () => {
      isDisposed = true;
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, [spec, isDark, onSelectPoint]);

  return (
    <Card className={`overflow-hidden border border-border shadow-xs ${className}`}>
      <CardHeader className="p-4 sm:p-5 border-b border-border/60 bg-surface/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-bold text-text flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-accent-teal" />
                <span>{spec.title}</span>
              </CardTitle>
              <ProofBadge proofType={spec.proofSummary.overallProofType} />
            </div>
            {spec.laymanQuestion && (
              <p className="text-xs font-medium text-accent-teal/90">{spec.laymanQuestion}</p>
            )}
            {spec.subtitle && (
              <CardDescription className="text-xs text-text-muted">{spec.subtitle}</CardDescription>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onOpenInsight && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenInsight(spec)}
                className="text-xs flex items-center gap-1.5 h-8 px-2.5 text-accent-teal hover:bg-accent-teal/10"
                title="Open proven explanation"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Explain</span>
              </Button>
            )}
            <Button
              variant={showTable ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowTable((prev) => !prev)}
              className="text-xs flex items-center gap-1.5 h-8 px-2.5"
              aria-label={`Toggle accessible data table for ${spec.title}`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>{showTable ? 'View Chart' : 'Show Data'}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {showTable ? (
          /* Accessible Data Table (A11y alternative) */
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-raised border-b border-border text-text font-semibold">
                <tr>
                  {spec.a11yTable.headers.map((h: string, i: number) => (
                    <th key={i} className="py-2.5 px-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {spec.a11yTable.rows.map((row: Array<string | number | null>, rIdx: number) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-surface-raised/50 cursor-pointer"
                    onClick={() => {
                      const point = spec.series[rIdx];
                      if (point && onSelectPoint) onSelectPoint(point);
                    }}
                  >
                    {row.map((cell: string | number | null, cIdx: number) => (
                      <td key={cIdx} className="py-2 px-3 text-text-muted font-mono">
                        {cell === null ? 'N/A' : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : spec.kind === 'key_figures_strip' ? (
          /* Key Figures Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {spec.series.map((point: VisualSeriesPoint) => (
              <div
                key={point.id || point.label}
                onClick={() => onSelectPoint && onSelectPoint(point)}
                className="p-4 rounded-xl bg-surface-raised/60 border border-border hover:border-accent-teal/40 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-text-muted truncate">{point.label}</p>
                  <ProofBadge proofType={point.proofType} showIcon={false} />
                </div>
                <p className="text-xl sm:text-2xl font-bold font-serif text-text tracking-tight group-hover:text-accent-teal transition-colors">
                  {point.value.toLocaleString('en-IN')}
                  {point.unit && (
                    <span className="text-xs font-sans font-normal text-text-muted ml-1.5">
                      {point.unit}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-1 text-[11px] text-accent-teal">
                  <Eye className="w-3 h-3" />
                  <span>Inspect Citation</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Interactive ECharts Surface */
          <div
            ref={chartRef}
            className="w-full h-[320px] sm:h-[380px]"
            role="img"
            aria-label={`${spec.title}. ${spec.subtitle || ''}`}
          />
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Builds deterministic ECharts options based on VisualSpec kind (PRD Section 6.1).
 */
function buildEChartsOption(spec: VisualSpec, isDark: boolean) {
  const palette = isDark ? ECHARTS_COLORS.dark : ECHARTS_COLORS.light;

  switch (spec.kind) {
    case 'donut_pie':
      return {
        tooltip: {
          trigger: 'item',
          formatter: '{b}: <b>{c}</b> ({d}%)',
        },
        legend: {
          bottom: '0%',
          left: 'center',
          textStyle: { color: palette.text, fontSize: 11 },
        },
        series: [
          {
            name: spec.title,
            type: 'pie',
            radius: ['42%', '70%'],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 6,
              borderColor: palette.surface,
              borderWidth: 2,
            },
            label: {
              show: true,
              formatter: '{b}: {d}%',
              color: palette.text,
              fontSize: 11,
            },
            data: spec.series.map((s: VisualSeriesPoint) => ({
              name: s.label,
              value: s.value,
            })),
          },
        ],
      };

    case 'treemap':
      return {
        tooltip: {
          formatter: '{b}: <b>{c}</b>',
        },
        series: [
          {
            type: 'treemap',
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            label: {
              show: true,
              formatter: '{b}\n{c}',
              fontSize: 12,
              color: palette.whiteText,
            },
            itemStyle: {
              borderColor: palette.surface,
              borderWidth: 2,
              gapWidth: 1,
            },
            data: spec.series.map((s: VisualSeriesPoint) => ({
              name: s.label,
              value: s.value,
            })),
          },
        ],
      };

    case 'horizontal_ranked_bar':
      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: '{b}: <b>{c}</b>',
        },
        grid: {
          left: '4%',
          right: '8%',
          bottom: '4%',
          top: '4%',
          containLabel: true,
        },
        xAxis: {
          type: 'value',
          axisLabel: { color: palette.subtext, fontSize: 11 },
          splitLine: { lineStyle: { color: palette.gridLine } },
        },
        yAxis: {
          type: 'category',
          data: spec.series.map((s: VisualSeriesPoint) => s.label).reverse(),
          axisLabel: { color: palette.text, fontSize: 11 },
        },
        series: [
          {
            type: 'bar',
            data: spec.series.map((s: VisualSeriesPoint) => s.value).reverse(),
            itemStyle: {
              borderRadius: [0, 4, 4, 0],
              color: palette.primary,
            },
          },
        ],
      };

    case 'slope_chart':
    case 'line_area':
      return {
        tooltip: {
          trigger: 'axis',
          formatter: '{b}: <b>{c}</b>',
        },
        grid: {
          left: '4%',
          right: '6%',
          bottom: '10%',
          top: '8%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: spec.series.map((s: VisualSeriesPoint) => s.label),
          axisLabel: { color: palette.text, fontSize: 11 },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: palette.subtext, fontSize: 11 },
          splitLine: { lineStyle: { color: palette.gridLine } },
        },
        series: [
          {
            type: 'line',
            data: spec.series.map((s: VisualSeriesPoint) => s.value),
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            lineStyle: { width: 3, color: palette.accentTeal },
            itemStyle: { color: palette.accentTeal },
            areaStyle: {
              color: palette.areaTeal,
            },
          },
        ],
      };

    default:
      return {
        xAxis: { type: 'category', data: spec.series.map((s: VisualSeriesPoint) => s.label) },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: spec.series.map((s: VisualSeriesPoint) => s.value) }],
      };
  }
}
