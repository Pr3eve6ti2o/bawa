// Minimal static server with SPA fallback for the Bawa web wallet preview.
// Serves a dist/ dir on 127.0.0.1. NOT vite preview (Vite 8 preview blocks
// non-allowed hosts and 403s through the Pinggy tunnel).
// Usage: node serve.mjs <dist-dir> <port>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 8087);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  let filePath = path.join(distDir, pathname);
  // SPA fallback: extensionless paths that do not exist serve index.html.
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (!path.extname(pathname)) {
      filePath = path.join(distDir, 'index.html');
    } else {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
  }
  const ext = path.extname(filePath);
  res.writeHead(200, {
    'content-type': TYPES[ext] || 'application/octet-stream',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'cache-control': pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`serving ${distDir} on http://127.0.0.1:${port}`);
});
