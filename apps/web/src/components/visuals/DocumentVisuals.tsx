import React, { useEffect, useRef, useState } from 'react';
import type { DocumentFactDetail } from '@juris/shared';
import {
  prepareTopAllocationsData,
  prepareTemporalTrendData,
  prepareCategoryFactCounts,
} from '@juris/shared';
import { loadJurisECharts } from '../../lib/echarts.js';
import { useTheme } from '../../theme.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from '../ui/index.js';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Table as TableIcon,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import type { init as initFn } from 'echarts/core';

type EChartsInstance = ReturnType<typeof initFn>;

interface DocumentVisualsProps {
  facts: DocumentFactDetail[];
  documentName: string;
}

export const DocumentVisuals: React.FC<DocumentVisualsProps> = ({ facts, documentName }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [showTables, setShowTables] = useState(false);

  // Chart DOM refs
  const barChartRef = useRef<HTMLDivElement>(null);
  const trendChartRef = useRef<HTMLDivElement>(null);
  const treemapChartRef = useRef<HTMLDivElement>(null);

  // Strict data preparation functions from shared contracts (VIZ-01, VIZ-06)
  const barData = prepareTopAllocationsData(facts);
  const trendData = prepareTemporalTrendData(facts);
  const categoryData = prepareCategoryFactCounts(facts);

  // Verification Summary counts
  const verifiedCount = facts.filter((f) => f.verified).length;
  const unverifiedCount = facts.filter((f) => !f.verified && !f.failReason).length;
  const failedCount = facts.filter((f) => !f.verified && f.failReason).length;

  useEffect(() => {
    let barInstance: EChartsInstance | null = null;
    let trendInstance: EChartsInstance | null = null;
    let treemapInstance: EChartsInstance | null = null;

    loadJurisECharts().then(({ init }) => {
      const themeName = isDark ? 'juris-dark' : 'juris-light';

      // 1. Render Top Allocations Bar Chart (Verified Facts Only)
      if (barChartRef.current && barData.status === 'ready') {
        barInstance = init(barChartRef.current, themeName);
        barInstance.setOption({
          title: {
            text: barData.title,
            subtext: `${documentName} (Verified Values Only)`,
            left: 'left',
          },
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: unknown) => {
              const items = Array.isArray(params) ? params : [params];
              const item = items[0] as { dataIndex: number } | undefined;
              if (!item) return '';
              const fact = barData.items[item.dataIndex];
              if (!fact) return '';
              return `<div style="font-weight:bold;margin-bottom:4px;">${fact.name}</div>
                      <div>Value: <b>${fact.value.toLocaleString()} ${barData.currency || ''}</b></div>
                      <div style="font-size:11px;color:var(--color-text-subtle);margin-top:4px;">Source: Page ${fact.page} (Verified)</div>`;
            },
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            containLabel: true,
          },
          xAxis: {
            type: 'category',
            data: barData.categories,
            axisLabel: {
              interval: 0,
              rotate: 25,
              fontSize: 11,
            },
          },
          yAxis: {
            type: 'value',
            axisLabel: {
              formatter: '{value}',
            },
          },
          series: [
            {
              name: 'Allocation',
              type: 'bar',
              data: barData.values,
              itemStyle: {
                borderRadius: [4, 4, 0, 0],
              },
            },
          ],
        });
      }

      // 2. Render Temporal Trend Line Chart (Verified Periods Only)
      if (trendChartRef.current && trendData.status === 'ready') {
        trendInstance = init(trendChartRef.current, themeName);
        trendInstance.setOption({
          title: {
            text: trendData.title,
            subtext: 'Aggregated by Cited Fiscal Period',
            left: 'left',
          },
          tooltip: {
            trigger: 'axis',
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '10%',
            containLabel: true,
          },
          xAxis: {
            type: 'category',
            data: trendData.periods,
          },
          yAxis: {
            type: 'value',
          },
          series: [
            {
              name: 'Total Period Allocation',
              type: 'line',
              data: trendData.values,
              smooth: true,
              symbol: 'circle',
              symbolSize: 8,
              lineStyle: {
                width: 2.5,
              },
            },
          ],
        });
      }

      // 3. Render Fact Counts Treemap (Thematic Weight)
      if (treemapChartRef.current && categoryData.status === 'ready') {
        treemapInstance = init(treemapChartRef.current, themeName);
        treemapInstance.setOption({
          title: {
            text: categoryData.title,
            subtext: categoryData.description,
            left: 'left',
          },
          tooltip: {
            formatter: '{b}',
          },
          series: [
            {
              type: 'treemap',
              data: categoryData.treemapData,
              roam: false,
              breadcrumb: { show: false },
              label: {
                show: true,
                formatter: '{b}',
              },
            },
          ],
        });
      }
    });

    const handleResize = () => {
      barInstance?.resize();
      trendInstance?.resize();
      treemapInstance?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      barInstance?.dispose();
      trendInstance?.dispose();
      treemapInstance?.dispose();
    };
  }, [facts, isDark, documentName, barData, trendData, categoryData]);

  return (
    <div className="space-y-8">
      {/* Top Controls & Integrity Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-surface border border-border">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-verified" />
            <span className="text-xs font-semibold text-text uppercase tracking-wider">
              Verification Coverage:
            </span>
          </div>
          <Badge variant="teal" className="text-xs">
            {verifiedCount} Verified
          </Badge>
          {unverifiedCount > 0 && (
            <Badge variant="neutral" className="text-xs">
              {unverifiedCount} Unverified
            </Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="neutral" className="text-xs text-failed border-failed-border">
              {failedCount} Failed
            </Badge>
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowTables(!showTables)}
          className="flex items-center gap-2 text-xs"
        >
          <TableIcon className="w-3.5 h-3.5" />
          <span>{showTables ? 'Hide Accessible Tables' : 'Show Accessible Tables (WCAG AA)'}</span>
        </Button>
      </div>

      {/* Primary Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Allocations Bar Chart Card */}
        <Card className="p-6 flex flex-col justify-between">
          <CardHeader className="p-0 pb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-accent-teal" />
              <CardTitle className="text-base">Top Quantitative Allocations</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Verified financial facts extracted from document text.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            {barData.status === 'ready' ? (
              <>
                <div ref={barChartRef} className="w-full h-80" />
                {showTables && (
                  <div
                    tabIndex={0}
                    role="region"
                    aria-label="Top quantitative allocations data table"
                    className="mt-4 border-t border-border pt-4 overflow-x-auto focus-visible:ring-1 focus-visible:ring-accent-teal"
                  >
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-border text-text-subtle">
                          <th className="text-left py-1">Fact / Allocation</th>
                          <th className="text-right py-1">Value</th>
                          <th className="text-right py-1">Unit</th>
                          <th className="text-right py-1">Page</th>
                        </tr>
                      </thead>
                      <tbody>
                        {barData.items.map((item, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-1 text-text truncate max-w-xs">{item.quote}</td>
                            <td className="py-1 text-right font-bold text-accent-teal">
                              {item.value.toLocaleString()}
                            </td>
                            <td className="py-1 text-right text-text-subtle">
                              {barData.currency || ''} {barData.unit || ''}
                            </td>
                            <td className="py-1 text-right text-text-subtle">p. {item.page}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center bg-surface-raised rounded-lg border border-border/60">
                <AlertCircle className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm font-medium text-text">No Quantified Allocations Displayed</p>
                <p className="text-xs text-text-muted max-w-sm mx-auto mt-1">
                  {barData.emptyReason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Temporal Trends or Category Distribution Card */}
        {trendData.status === 'ready' ? (
          <Card className="p-6 flex flex-col justify-between">
            <CardHeader className="p-0 pb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent-teal" />
                <CardTitle className="text-base">Fiscal Period Breakdown</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Multi-year allocations extracted with explicit period citations.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div ref={trendChartRef} className="w-full h-80" />
              {showTables && (
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Fiscal period breakdown data table"
                  className="mt-4 border-t border-border pt-4 overflow-x-auto focus-visible:ring-1 focus-visible:ring-accent-teal"
                >
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border text-text-subtle">
                        <th className="text-left py-1">Fiscal Period</th>
                        <th className="text-right py-1">Sum ({trendData.currency || ''})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendData.periods.map((p, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-1 text-text">{p}</td>
                          <td className="py-1 text-right font-bold text-accent-teal">
                            {trendData.values[i]?.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Fact Counts by Category Treemap */
          <Card className="p-6 flex flex-col justify-between">
            <CardHeader className="p-0 pb-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-accent-teal" />
                <CardTitle className="text-base">
                  Fact Counts by Category (Thematic Weight)
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                Proportion of facts across topic areas (fact counts, not expenditure share).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              {categoryData.status === 'ready' ? (
                <>
                  <div ref={treemapChartRef} className="w-full h-80" />
                  {showTables && (
                    <div
                      tabIndex={0}
                      role="region"
                      aria-label="Fact counts by category data table"
                      className="mt-4 border-t border-border pt-4 overflow-x-auto focus-visible:ring-1 focus-visible:ring-accent-teal"
                    >
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr className="border-b border-border text-text-subtle">
                            <th className="text-left py-1">Category</th>
                            <th className="text-right py-1">Count</th>
                            <th className="text-right py-1">Verified</th>
                            <th className="text-right py-1">Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryData.categories.map((c, i) => (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-1 text-text">{c.category}</td>
                              <td className="py-1 text-right font-bold text-accent-teal">
                                {c.count}
                              </td>
                              <td className="py-1 text-right text-text-subtle">
                                {c.verifiedCount}
                              </td>
                              <td className="py-1 text-right text-text-subtle">{c.percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center bg-surface-raised rounded-lg border border-border/60">
                  <FileSpreadsheet className="w-8 h-8 text-text-muted mx-auto mb-2" />
                  <p className="text-sm font-medium text-text">No Categories Available</p>
                  <p className="text-xs text-text-muted max-w-sm mx-auto mt-1">
                    {categoryData.emptyReason}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
