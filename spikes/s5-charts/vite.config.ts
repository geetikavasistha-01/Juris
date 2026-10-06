import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve('spikes/s5-charts'),
  build: {
    outDir: path.resolve('spikes/s5-charts/dist'),
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('echarts') || id.includes('zrender')) {
            return 'charts-vendor';
          }
        },
      },
    },
  },
});
