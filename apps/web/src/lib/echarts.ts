/**
 * Modular ECharts loader for Juris
 *
 * Lazily loads the deep-registered `echarts-setup.js` module on-demand when charts render.
 */

import type { init as initFn } from 'echarts/core';

let initializedPromise: Promise<{
  init: typeof initFn;
}> | null = null;

export function loadJurisECharts() {
  if (!initializedPromise) {
    initializedPromise = import('./echarts-setup.js').then((m) => ({
      init: m.init,
    }));
  }
  return initializedPromise;
}
