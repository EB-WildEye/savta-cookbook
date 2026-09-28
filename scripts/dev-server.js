/* Local preview without Redis: serves the site and an in-memory /api/entries.
   Run: npm run dev   then open http://localhost:3000 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';
import { handle } from '../lib/entries.js';

const root = join(import.meta.dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const hashes = new Map(), counters = new Map();
const h = k => { if (!hashes.has(k)) hashes.set(k, new Map()); return hashes.get(k); };
const memory = {
  async hgetall(k) { const m = h(k); return m.size ? Object.fromEntries(m) : null; },
  async hget(k, f) { return h(k).get(f) ?? null; },
  async hset(k, obj) { for (const [f, v] of Object.entries(obj)) h(k).set(f, v); return 1; },
  async hdel(k, f) { return h(k).delete(f) ? 1 : 0; },
  async incr(k) { const v = (counters.get(k) || 0) + 1; counters.set(k, v); return v; },
  async expire() { return 1; }
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/entries') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
    const result = await handle(memory, { method: req.method, body, ip: 'local', newId: randomUUID });
    res.writeHead(result.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(result.body));
  }
  const path = normalize(url.pathname === '/' ? '/index.html' : url.pathname);
  if (path.includes('..') || !types[extname(path)]) { res.writeHead(404); return res.end(); }
  try {
    const file = await readFile(join(root, path));
    res.writeHead(200, { 'Content-Type': types[extname(path)] });
    res.end(file);
  } catch { res.writeHead(404); res.end(); }
}).listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
