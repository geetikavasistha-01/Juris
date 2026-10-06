import { REAL_BUDGET_DATA, type RealBudgetData } from './budget-data.js';
import type { ChartRegistry } from './charts-engine.js';

export interface SpikeS5State {
  chartsLoaded: boolean;
  selectedCategory: string | null;
  selectedAmount: number | null;
  selectedPage: number | null;
  realData: RealBudgetData | null;
}

declare global {
  interface Window {
    __SPIKE_S5_STATE__?: SpikeS5State;
    __SPIKE_S5_CHARTS__?: ChartRegistry;
  }
}

window.__SPIKE_S5_STATE__ = {
  chartsLoaded: false,
  selectedCategory: null,
  selectedAmount: null,
  selectedPage: null,
  realData: null,
};

async function init() {
  console.info('Spike S5: Initializing App Shell...');

  // 1. Render Key Figures Strip (Immediate, no chart library loaded yet)
  const data = REAL_BUDGET_DATA;
  if (window.__SPIKE_S5_STATE__) {
    window.__SPIKE_S5_STATE__.realData = data;
  }

  const keyFiguresEl = document.getElementById('key-figures-strip')!;
  keyFiguresEl.innerHTML = `
    <div class="kpi-card" id="kpi-total">
      <span class="label">Total Expenditure</span>
      <span class="value">₹${data.totalExpenditure.toLocaleString()} Cr</span>
      <span class="badge">+6.4% YoY</span>
    </div>
    <div class="kpi-card" id="kpi-capital">
      <span class="label">Capital Expenditure</span>
      <span class="value">₹${data.capitalExpenditure.toLocaleString()} Cr</span>
      <span class="badge highlight">+16.9% YoY</span>
    </div>
    <div class="kpi-card" id="kpi-revenue">
      <span class="label">Revenue Expenditure</span>
      <span class="value">₹${data.revenueExpenditure.toLocaleString()} Cr</span>
      <span class="badge">+3.8% YoY</span>
    </div>
    <div class="kpi-card" id="kpi-capex-share">
      <span class="label">CapEx / Total Share</span>
      <span class="value">${((data.capitalExpenditure / data.totalExpenditure) * 100).toFixed(1)}%</span>
      <span class="badge highlight">Record High</span>
    </div>
  `;

  // 2. Lazy-load ECharts chart chunk on demand
  console.info('Spike S5: Dynamically importing tree-shaken ECharts chunk...');
  const { initCivicCharts } = await import('./charts-engine.js');

  const charts = initCivicCharts(
    {
      treemap: 'chart-treemap',
      bar: 'chart-bar',
      line: 'chart-line',
      sunburst: 'chart-sunburst',
      heatmap: 'chart-heatmap',
    },
    data,
    (category, amount, page) => {
      console.info(
        `[Cross-Filtering Event] Category: ${category}, Amount: ₹${amount} Cr, Source Page: ${page}`,
      );
      if (window.__SPIKE_S5_STATE__) {
        window.__SPIKE_S5_STATE__.selectedCategory = category;
        window.__SPIKE_S5_STATE__.selectedAmount = amount;
        window.__SPIKE_S5_STATE__.selectedPage = page;
      }

      const detailEl = document.getElementById('selected-detail')!;
      detailEl.innerHTML = `
        <div class="selection-box">
          <strong>Selected: ${category}</strong> | Allocation: ₹${amount.toLocaleString()} Crore | Source: <em>Page ${page}</em>
        </div>
      `;
    },
  );

  if (window.__SPIKE_S5_STATE__) {
    window.__SPIKE_S5_STATE__.chartsLoaded = true;
  }
  window.__SPIKE_S5_CHARTS__ = charts;
  console.info(
    'Spike S5: 6 Civic Charts successfully rendered and cross-filter listeners attached.',
  );
}

init().catch((err) => console.error('Failed to initialize Spike S5:', err));
