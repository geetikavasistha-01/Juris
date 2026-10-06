import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export function createViewerServer(port: number = 3456): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url ? req.url.split('?')[0] : '/';

      if (urlPath === '/' || urlPath === '/index.html') {
        const html = fs.readFileSync(path.resolve('spikes/s3-pdf-extraction/index.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }

      if (urlPath === '/pdfjs-dist/build/pdf.mjs') {
        const file = fs.readFileSync(path.resolve('node_modules/pdfjs-dist/build/pdf.mjs'));
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(file);
        return;
      }

      if (urlPath === '/pdfjs-dist/build/pdf.worker.mjs') {
        const file = fs.readFileSync(path.resolve('node_modules/pdfjs-dist/build/pdf.worker.mjs'));
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(file);
        return;
      }

      if (urlPath.startsWith('/docs/pdf/')) {
        const filePath = path.resolve('.' + urlPath);
        if (fs.existsSync(filePath)) {
          const file = fs.readFileSync(filePath);
          res.writeHead(200, { 'Content-Type': 'application/pdf' });
          res.end(file);
          return;
        }
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(port, () => {
      resolve(server);
    });
  });
}
