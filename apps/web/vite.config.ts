import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'echarts-chunk-analyzer',
      generateBundle(options, bundle) {
        for (const [fileName, chunk] of Object.entries(bundle)) {
          if (chunk.type === 'chunk' && fileName.includes('echarts')) {
            console.info('\n=== ECHARTS CHUNK MODULE BREAKDOWN (' + fileName + ') ===');
            const modules = Object.entries(chunk.modules)
              .map(([id, mod]) => ({
                module: id.replace(/.*node_modules\//, ''),
                bytes: mod.renderedLength,
              }))
              .sort((a, b) => b.bytes - a.bytes);

            // Aggregate by subpackage / module family
            const aggregated: Record<string, number> = {};
            for (const m of modules) {
              const prefix = m.module.split('/').slice(0, 3).join('/');
              aggregated[prefix] = (aggregated[prefix] || 0) + m.bytes;
            }

            console.info('--- Subpackage Aggregation ---');
            for (const [pkg, bytes] of Object.entries(aggregated).sort((a, b) => b[1] - a[1])) {
              console.info(`${pkg.padEnd(45)}: ${(bytes / 1024).toFixed(2)} kB`);
            }

            console.info('\n--- Top 20 Modules by Rendered Size ---');
            for (const m of modules.slice(0, 20)) {
              console.info(`${m.module.padEnd(55)}: ${(m.bytes / 1024).toFixed(2)} kB`);
            }
            console.info('========================================================\n');
          }
        }
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
    __GIT_SHA__: JSON.stringify(process.env.GIT_SHA || 'dev'),
  },
});
