import React, { useEffect, useRef, useState } from 'react';
import type { DocumentFactDetail } from '@juris/shared';
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
  Info,
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

  // Extract numeric facts
  const numericFacts = facts
    .filter((f) => f.value !== null && typeof f.value === 'number' && !Number.isNaN(f.value))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  // 1. Top Allocations & Metrics Data (Bar Chart)
  const topAllocations = numericFacts.slice(0, 8);
  const barCategories = topAllocations.map((f) =>
    f.quote.length > 28 ? `${f.quote.substring(0, 26)}...` : f.quote,
  );
  const barValues = topAllocations.map((f) => f.value);

  // 2. Period/Temporal Trend Data (Line Chart)
  const factsWithPeriod = numericFacts.filter((f) => Boolean(f.period));
  // Group by period
  const periodMap = new Map<string, number>();
  for (const f of factsWithPeriod) {
    const period = f.period || 'Current';
    periodMap.set(period, (periodMap.get(period) || 0) + (f.value || 0));
  }
  const trendPeriods = Array.from(periodMap.keys());
  const trendValues = Array.from(periodMap.values());

  // 3. Category Breakdown Data (Treemap)
  const categoryMap = new Map<string, number>();
  for (const f of numericFacts) {
    const cat = f.type ? f.type.toUpperCase() : 'GENERAL';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + (f.value || 0));
  }
  const treemapData = Array.from(categoryMap.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  // Verification Summary
  const verifiedCount = facts.filter((f) => f.verified).length;
  const unverifiedCount = facts.filter((f) => !f.verified && !f.failReason).length;
  const failedCount = facts.filter((f) => !f.verified && f.failReason).length;

  useEffect(() => {
    let barInstance: EChartsInstance | null = null;
    let trendInstance: EChartsInstance | null = null;
    let treemapInstance: EChartsInstance | null = null;

    loadJurisECharts().then(({ init }) => {
      const themeName = isDark ? 'juris-dark' : 'juris-light';

      // 1. Render Bar Chart
      if (barChartRef.current && topAllocations.length > 0) {
        barInstance = init(barChartRef.current, themeName);
        barInstance.setOption({
          title: {
            text: 'Top Quantified Facts & Allocations',
            subtext: `${documentName} (Verified Values)`,
            left: 'left',
          },
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '15%',
            containLabel: true,
          },
          xAxis: {
            type: 'category',
            data: barCategories,
            axisLabel: {
              interval: 0,
              rotate: 25,
              fontSize: 11,
            },
          },
          yAxis: {
            type: 'value',
          },
          series: [
            {
              name: 'Amount / Metric',
              type: 'bar',
              data: barValues,
              itemStyle: {
                borderRadius: [4, 4, 0, 0],
              },
            },
          ],
        });
      }

      // 2. Render Trend Line Chart
      if (trendChartRef.current && trendPeriods.length > 0) {
        trendInstance = init(trendChartRef.current, themeName);
        trendInstance.setOption({
          title: {
            text: 'Allocations Across Fiscal Periods',
            subtext: 'Aggregated by Cited Period',
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
            data: trendPeriods,
          },
          yAxis: {
            type: 'value',
          },
          series: [
            {
              name: 'Total Period Amount',
              type: 'line',
              data: trendValues,
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

      // 3. Render Treemap Chart
      if (treemapChartRef.current && treemapData.length > 0) {
        treemapInstance = init(treemapChartRef.current, themeName);
        treemapInstance.setOption({
          title: {
            text: 'Fact Distribution by Type',
            subtext: 'Proportional Weight of Extracted Civic Data',
            left: 'left',
          },
          tooltip: {
            formatter: '{b}: {c}',
          },
          series: [
            {
              type: 'treemap',
              data: treemapData,
              roam: false,
              breadcrumb: { show: false },
              label: {
                show: true,
                formatter: '{b}\n{c}',
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
  }, [facts, isDark, documentName]);

  if (numericFacts.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed">
        <Info className="w-10 h-10 text-text-muted mx-auto mb-3" />
        <h3 className="font-serif text-lg font-bold text-text">No Numerical Facts Extracted</h3>
        <p className="text-sm text-text-muted max-w-md mx-auto mt-1">
          This document contains narrative facts without quantitative numerical allocations.
        </p>
      </Card>
    );
  }

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
        {/* Top Allocations Bar Chart */}
        <Card className="p-6 flex flex-col justify-between">
          <CardHeader className="p-0 pb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-accent-teal" />
              <CardTitle className="text-base">Top Quantitative Allocations</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Highest-value extracted budget allocations and numeric facts.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div ref={barChartRef} className="w-full h-80" />
            {showTables && (
              <div className="mt-4 border-t border-border pt-4 overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border text-text-subtle">
                      <th className="text-left py-1">Fact / Allocation</th>
                      <th className="text-right py-1">Value</th>
                      <th className="text-right py-1">Page</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAllocations.map((f, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1 text-text truncate max-w-xs">{f.quote}</td>
                        <td className="py-1 text-right font-bold text-accent-teal">
                          {f.value?.toLocaleString()}
                        </td>
                        <td className="py-1 text-right text-text-subtle">p. {f.page}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Temporal Trends Line Chart */}
        {trendPeriods.length > 0 ? (
          <Card className="p-6 flex flex-col justify-between">
            <CardHeader className="p-0 pb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent-teal" />
                <CardTitle className="text-base">Fiscal Period Breakdown</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Multi-year allocations and projections extracted from document text.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div ref={trendChartRef} className="w-full h-80" />
              {showTables && (
                <div className="mt-4 border-t border-border pt-4 overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border text-text-subtle">
                        <th className="text-left py-1">Period</th>
                        <th className="text-right py-1">Aggregated Allocation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendPeriods.map((p, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-1 text-text">{p}</td>
                          <td className="py-1 text-right font-bold text-accent-teal">
                            {trendValues[i]?.toLocaleString()}
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
          /* Category Treemap Chart */
          <Card className="p-6 flex flex-col justify-between">
            <CardHeader className="p-0 pb-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-accent-teal" />
                <CardTitle className="text-base">Fact Distribution by Type</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Proportional category weight across all extracted facts.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div ref={treemapChartRef} className="w-full h-80" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
