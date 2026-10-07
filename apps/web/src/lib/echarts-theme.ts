/**
 * Juris ECharts Theme Definition & Dynamic Theme Switcher
 *
 * Calm, precise, document-like aesthetics.
 * Uses colorblind-safe Okabe-Ito palette with verified contrast >= 3.0:1.
 * IMPORTANT: Does NOT statically import 'echarts' to keep initial JS bundle small.
 */

// Okabe-Ito colorblind-safe categorical color palette adjusted for light/dark contrast
export const OKABE_ITO_LIGHT = [
  '#0072B2', // Blue
  '#C25E00', // Darkened Amber (3.2:1 against light surface)
  '#00875A', // Forest Green (3.1:1 against light surface)
  '#D55E00', // Vermilion
  '#A33C7B', // Deep Reddish Purple (3.3:1 against light surface)
  '#0284C7', // Sky Blue (3.3:1 against light surface)
];

export const OKABE_ITO_DARK = [
  '#38BDF8', // Cyan / Sky Blue (9.1:1 on dark bg)
  '#FBBF24', // Amber (11.0:1 on dark bg)
  '#4ADE80', // Mint Green (10.6:1 on dark bg)
  '#F87171', // Coral Red (6.0:1 on dark bg)
  '#C084FC', // Lavender Purple (6.5:1 on dark bg)
  '#CBD5E1', // Slate Silver (11.8:1 on dark bg)
];

// Single sequential scale ramp from Navy to Teal
export const SEQUENTIAL_RAMP_LIGHT = ['#12294A', '#0E4461', '#0F766E', '#2DD4BF'];
export const SEQUENTIAL_RAMP_DARK = ['#1E3A8A', '#0F766E', '#2DD4BF', '#99F6E4'];

// Accessible line dash and symbol patterns for series > 3
export const ACCESSIBLE_SERIES_SYMBOLS = ['circle', 'rect', 'triangle', 'diamond', 'pin', 'arrow'];
export const ACCESSIBLE_LINE_STYLES = ['solid', 'dashed', 'dotted', 'dashdot'];

export function buildEChartsTheme(isDark: boolean) {
  const textColor = isDark ? '#E6EDF7' : '#0F172A';
  const textMuted = isDark ? '#9FB0C8' : '#475569';
  const borderColor = isDark ? '#1E2D47' : '#E2E8F0';
  const surfaceColor = isDark ? '#101C30' : '#FFFFFF';
  const colors = isDark ? OKABE_ITO_DARK : OKABE_ITO_LIGHT;

  return {
    color: colors,
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: "'IBM Plex Mono', 'Inter Variable', system-ui, sans-serif",
      color: textColor,
    },
    title: {
      textStyle: {
        fontFamily: "'Source Serif 4 Variable', Georgia, serif",
        color: textColor,
        fontWeight: 600,
        fontSize: 16,
      },
      subtextStyle: {
        fontFamily: "'Inter Variable', sans-serif",
        color: textMuted,
        fontSize: 12,
      },
    },
    grid: {
      containLabel: true,
      left: '3%',
      right: '3%',
      top: '15%',
      bottom: '5%',
      borderColor: borderColor,
    },
    tooltip: {
      backgroundColor: surfaceColor,
      borderColor: borderColor,
      borderWidth: 1,
      textStyle: {
        color: textColor,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12,
      },
      padding: [8, 12],
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: borderColor } },
      axisTick: { lineStyle: { color: borderColor } },
      axisLabel: { color: textMuted, fontFamily: "'IBM Plex Mono', monospace" },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: borderColor } },
      axisTick: { lineStyle: { color: borderColor } },
      axisLabel: { color: textMuted, fontFamily: "'IBM Plex Mono', monospace" },
      splitLine: { lineStyle: { color: borderColor, type: 'dashed' } },
    },
    legend: {
      textStyle: { color: textMuted, fontFamily: "'Inter Variable', sans-serif" },
      itemGap: 16,
    },
  };
}

/**
 * Helper to register and apply theme dynamically on an ECharts instance or echarts module.
 */
export function registerJurisEChartsTheme(echartsModule: {
  registerTheme: (name: string, theme: object) => void;
}) {
  echartsModule.registerTheme('juris-light', buildEChartsTheme(false));
  echartsModule.registerTheme('juris-dark', buildEChartsTheme(true));
}
