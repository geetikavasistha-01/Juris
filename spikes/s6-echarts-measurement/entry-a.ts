import { loadPatternA } from './pattern-a.js';

export async function renderCharts() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const { init } = await loadPatternA();
  const chart = init(container);

  chart.setOption({
    title: { text: 'Test Civic Budget' },
    tooltip: {},
    xAxis: { data: ['A', 'B', 'C'] },
    yAxis: {},
    series: [
      { type: 'bar', data: [10, 20, 30] },
      { type: 'line', data: [15, 25, 35] },
      {
        type: 'treemap',
        data: [{ name: 'Node1', value: 10, children: [{ name: 'Child1', value: 10 }] }],
      },
    ],
  });
}

// Initial application shell
console.log('App shell initialized. Rendering charts on demand...');
renderCharts();
