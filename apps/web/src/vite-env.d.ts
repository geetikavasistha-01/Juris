/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __GIT_SHA__: string;

declare module 'echarts/lib/chart/bar/install.js' {
  import type { EChartsExtensionInstallers } from 'echarts/core';
  export const install: EChartsExtensionInstallers;
}
declare module 'echarts/lib/chart/line/install.js' {
  import type { EChartsExtensionInstallers } from 'echarts/core';
  export const install: EChartsExtensionInstallers;
}
declare module 'echarts/lib/chart/treemap/install.js' {
  import type { EChartsExtensionInstallers } from 'echarts/core';
  export const install: EChartsExtensionInstallers;
}
declare module 'echarts/lib/component/grid/install.js' {
  import type { EChartsExtensionInstallers } from 'echarts/core';
  export const install: EChartsExtensionInstallers;
}
declare module 'echarts/lib/component/tooltip/install.js' {
  import type { EChartsExtensionInstallers } from 'echarts/core';
  export const install: EChartsExtensionInstallers;
}
declare module 'echarts/lib/component/legend/install.js' {
  import type { EChartsExtensionInstallers } from 'echarts/core';
  export const install: EChartsExtensionInstallers;
}
declare module 'echarts/lib/component/dataset/install.js' {
  import type { EChartsExtensionInstallers } from 'echarts/core';
  export const install: EChartsExtensionInstallers;
}
declare module 'echarts/lib/component/title/install.js' {
  import type { EChartsExtensionInstallers } from 'echarts/core';
  export const install: EChartsExtensionInstallers;
}
declare module 'echarts/lib/renderer/installCanvasRenderer.js' {
  import type { EChartsExtensionInstallers } from 'echarts/core';
  export const install: EChartsExtensionInstallers;
}
