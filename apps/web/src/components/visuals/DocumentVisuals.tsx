import React, { useEffect, useRef, useState } from 'react';
import type { DocumentFactDetail } from '@juris/shared';
import { prepareTopAllocationsData, prepareTemporalTrendData } from '@juris/shared';
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
  Table as TableIcon,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Coins,
  Layers,
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

  // Strict data preparation functions from shared contracts (VIZ-01, VIZ-06)
  const barData = prepareTopAllocationsData(facts);
  const trendData = prepareTemporalTrendData(facts);

  // Verification Summary counts
  const verifiedCount = facts.filter((f) => f.verified).length;
  const unverifiedCount = facts.filter((f) => !f.verified && !f.failReason).length;
  const failedCount = facts.filter((f) => !f.verified && f.failReason).length;

  useEffect(() => {
    let barInstance: EChartsInstance | null = null;
    let trendInstance: EChartsInstance | null = null;

    loadJurisECharts().then(({ init }) => {
      const themeName = isDark ? 'juris-dark' : 'juris-light';

      // 1. Render Top Allocations Bar Chart (Verified Line-Item Facts Only)
      if (barChartRef.current && barData.status === 'ready') {
        barInstance = init(barChartRef.current, themeName);
        barInstance.setOption({
          title: {
            text: barData.title,
            subtext: `${documentName} (Line-Item Allocations Only)`,
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
            subtext: 'Aggregated by Cited Fiscal Period (BE / RE / Actual)',
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
    });

    const handleResize = () => {
      barInstance?.resize();
      trendInstance?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      barInstance?.dispose();
      trendInstance?.dispose();
    };
  }, [facts, isDark, documentName, barData, trendData]);

  return (
    <div className="space-y-8">
      {/* Key Figures Strip (VIZ-02) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-surface border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-verified-bg text-verified">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-mono text-text-subtle uppercase tracking-wider">
                Verified Facts
              </p>
              <h3 className="text-xl font-bold text-text mt-0.5">
                {verifiedCount} / {facts.length}
              </h3>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-teal-subtle text-accent-teal">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-mono text-text-subtle uppercase tracking-wider">
                Dominant Currency
              </p>
              <h3 className="text-xl font-bold text-text mt-0.5">
                {barData.currency || 'INR'} ({barData.unit || 'crore'})
              </h3>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-surface-raised text-brand-navy">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-mono text-text-subtle uppercase tracking-wider">
                Ranked Line Items
              </p>
              <h3 className="text-xl font-bold text-text mt-0.5">{barData.items.length}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-surface-raised text-accent-teal">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-mono text-text-subtle uppercase tracking-wider">
                Verifiability Rule
              </p>
              <h3 className="text-xs font-semibold text-text mt-0.5">VIZ-01 Strict Verifier</h3>
            </div>
          </div>
        </Card>
      </div>

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

      {/* Primary Visualizations Grid (Bar Chart & Temporal Trend Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Allocations Bar Chart Card */}
        <Card className="p-6 flex flex-col justify-between bg-surface border border-border">
          <CardHeader className="p-0 pb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-accent-teal" />
              <CardTitle className="text-base text-text">Top Quantitative Allocations</CardTitle>
            </div>
            <CardDescription className="text-xs text-text-subtle">
              Verified financial facts extracted from document text (excluding aggregate totals).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            {barData.status === 'ready' ? (
              <>
                <div ref={barChartRef} className="w-full h-80" />
                {barData.excludedCount && barData.excludedCount > 0 ? (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-text-subtle">
                    <Info className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{barData.excludedReason}</span>
                  </div>
                ) : null}
                {showTables && (
                  <div
                    tabIndex={0}
                    role="region"
                    aria-label="Top quantitative allocations data table"
                    className="mt-4 border-t border-border pt-4 overflow-x-auto bg-surface rounded focus-visible:ring-1 focus-visible:ring-accent-teal"
                  >
                    <table className="w-full text-xs font-mono bg-surface">
                      <thead>
                        <tr className="border-b border-border text-text font-semibold">
                          <th className="text-left py-1 text-text">Fact / Allocation</th>
                          <th className="text-right py-1 text-text">Value</th>
                          <th className="text-right py-1 text-text">Unit</th>
                          <th className="text-right py-1 text-text">Page</th>
                        </tr>
                      </thead>
                      <tbody>
                        {barData.items.map((item, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-1 text-text truncate max-w-xs">{item.quote}</td>
                            <td className="py-1 text-right font-bold text-text">
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
                <AlertCircle className="w-8 h-8 text-text-subtle mx-auto mb-2" />
                <p className="text-sm font-medium text-text">No Quantified Allocations Displayed</p>
                <p className="text-xs text-text-subtle max-w-sm mx-auto mt-1">
                  {barData.emptyReason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Temporal Trends Card */}
        <Card className="p-6 flex flex-col justify-between bg-surface border border-border">
          <CardHeader className="p-0 pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent-teal" />
              <CardTitle className="text-base text-text">Fiscal Period Breakdown</CardTitle>
            </div>
            <CardDescription className="text-xs text-text-subtle">
              Multi-year allocations extracted with explicit period citations (BE / RE / Actual).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            {trendData.status === 'ready' ? (
              <>
                <div ref={trendChartRef} className="w-full h-80" />
                {trendData.excludedCount && trendData.excludedCount > 0 ? (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-text-subtle">
                    <Info className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{trendData.excludedReason}</span>
                  </div>
                ) : null}
                {showTables && (
                  <div
                    tabIndex={0}
                    role="region"
                    aria-label="Fiscal period breakdown data table"
                    className="mt-4 border-t border-border pt-4 overflow-x-auto bg-surface rounded focus-visible:ring-1 focus-visible:ring-accent-teal"
                  >
                    <table className="w-full text-xs font-mono bg-surface">
                      <thead>
                        <tr className="border-b border-border text-text font-semibold">
                          <th className="text-left py-1">Fiscal Period</th>
                          <th className="text-right py-1">Sum ({trendData.currency || ''})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trendData.periods.map((p, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-1 text-text">{p}</td>
                            <td className="py-1 text-right font-bold text-text">
                              {trendData.values[i]?.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center bg-surface-raised rounded-lg border border-border/60">
                <AlertCircle className="w-8 h-8 text-text-subtle mx-auto mb-2" />
                <p className="text-sm font-medium text-text">No Fiscal Period Breakdown</p>
                <p className="text-xs text-text-subtle max-w-sm mx-auto mt-1">
                  {trendData.emptyReason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
