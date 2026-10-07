import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMeasurement(name, entryFile) {
  const outDir = join(__dirname, `dist-${name}`);
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }

  console.log(`\n========================================`);
  console.log(`Building ${name} (${entryFile})...`);
  console.log(`========================================`);

  await build({
    root: __dirname,
    build: {
      outDir,
      emptyOutDir: true,
      minify: 'esbuild',
      rollupOptions: {
        input: join(__dirname, entryFile),
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name]-[hash].js',
        },
      },
    },
    logLevel: 'warn',
  });

  const files = readdirSync(outDir).filter((f) => f.endsWith('.js'));
  console.log(`\nChunk Breakdown for ${name}:`);
  console.log(
    `| Chunk File | Raw Size (bytes) | Raw Size (kB) | Gzip Size (bytes) | Gzip Size (kB) |`,
  );
  console.log(`| :--- | :--- | :--- | :--- | :--- |`);

  let totalRaw = 0;
  let totalGzip = 0;

  for (const f of files) {
    const rawBuffer = readFileSync(join(outDir, f));
    const gzipBuffer = gzipSync(rawBuffer);
    const rawBytes = rawBuffer.length;
    const gzipBytes = gzipBuffer.length;
    totalRaw += rawBytes;
    totalGzip += gzipBytes;
    console.log(
      `| \`${f}\` | ${rawBytes.toLocaleString()} B | ${(rawBytes / 1024).toFixed(2)} kB | ${gzipBytes.toLocaleString()} B | ${(gzipBytes / 1024).toFixed(2)} kB |`,
    );
  }

  console.log(
    `| **Total** | **${totalRaw.toLocaleString()} B** | **${(totalRaw / 1024).toFixed(2)} kB** | **${totalGzip.toLocaleString()} B** | **${(totalGzip / 1024).toFixed(2)} kB** |`,
  );

  return { name, files, totalRaw, totalGzip };
}

async function main() {
  const resA = await runMeasurement('Pattern A (Dynamic barrel destructuring)', 'entry-a.ts');
  const resB = await runMeasurement('Pattern B (Lazy-loaded static named imports)', 'entry-b.ts');

  console.log(`\n========================================`);
  console.log(`Summary Comparison`);
  console.log(`========================================`);
  console.log(`Pattern A Gzip Total: ${(resA.totalGzip / 1024).toFixed(2)} kB`);
  console.log(`Pattern B Gzip Total: ${(resB.totalGzip / 1024).toFixed(2)} kB`);
  console.log(
    `Difference: ${((resA.totalGzip - resB.totalGzip) / 1024).toFixed(2)} kB savings with Pattern B`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
