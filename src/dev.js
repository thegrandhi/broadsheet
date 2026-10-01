import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.js';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.csv': 'text/csv; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.yml': 'text/yaml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};

export function dev({ root = process.cwd(), port = 4321 } = {}) {
  const out = path.resolve(root, 'dist');
  const clients = new Set();
  let lastError = null;

  let running = false, again = false;
  const rebuild = async () => {
    if (running) { again = true; return; }
    running = true;
    try {
      await build({ root, drafts: true, dev: true });
      lastError = null;
    } catch (e) {
      lastError = e;
      console.error(`\n✗ ${e.message}\n`);
    }
    running = false;
    for (const res of clients) res.write('data: reload\n\n');
    if (again) { again = false; rebuild(); }
  };
  rebuild();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/__reload') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (lastError) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      const msg = String(lastError.message).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      res.end(`<!doctype html><title>Build error</title><body style="font:15px/1.5 system-ui;padding:32px;max-width:760px;margin:auto"><h1 style="font-size:20px">Build failed</h1><pre style="white-space:pre-wrap;background:#f6f6f4;padding:16px">${msg}</pre><p>Fix the file and save; this page reloads on its own.</p><script>new EventSource('/__reload').onmessage=()=>location.reload()</script>`);
      return;
    }
    let file = path.join(out, decodeURIComponent(url.pathname));
    if (!file.startsWith(out)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' }).end(); return; }
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });

  let timer = null;
  const watchTargets = [path.join(root, 'content'), path.join(root, 'static'), path.join(root, 'site.yml'), path.join(PKG, 'theme'), path.join(PKG, 'src')];
  for (const target of watchTargets) {
    if (!fs.existsSync(target)) continue;
    fs.watch(target, { recursive: fs.statSync(target).isDirectory() }, () => {
      clearTimeout(timer);
      timer = setTimeout(rebuild, 80);
    });
  }

  server.listen(port, () => console.log(`\nBroadsheet dev server: http://localhost:${port}\nWatching content/ for changes. Drafts are shown. Ctrl+C to stop.\n`));
  return server;
}
