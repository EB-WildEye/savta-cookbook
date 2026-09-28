import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, LIMITS } from '../lib/entries.js';

function fakeStore() {
  const hashes = new Map(), counters = new Map();
  const h = k => { if (!hashes.has(k)) hashes.set(k, new Map()); return hashes.get(k); };
  return {
    async hgetall(k) { const m = h(k); return m.size ? Object.fromEntries(m) : null; },
    async hget(k, f) { return h(k).get(f) ?? null; },
    async hset(k, obj) { for (const [f, v] of Object.entries(obj)) h(k).set(f, v); return 1; },
    async hdel(k, f) { return h(k).delete(f) ? 1 : 0; },
    async incr(k) { const v = (counters.get(k) || 0) + 1; counters.set(k, v); return v; },
    async expire() { return 1; }
  };
}
let n = 0;
const ctx = (body, method = 'POST') => ({ method, body, ip: '1.2.3.4', newId: () => 'id' + (++n) });

test('add, update status, remove', async () => {
  const s = fakeStore();
  let r = await handle(s, ctx({ action: 'add', task: 'notebook', name: '  Noa ', part: 'pages 1-10', status: 'doing' }));
  assert.equal(r.status, 200);
  const [e] = r.body.entries;
  assert.equal(e.name, 'Noa'); assert.equal(e.status, 'doing');
  r = await handle(s, ctx({ action: 'status', id: e.id, status: 'done' }));
  assert.equal(r.body.entries[0].status, 'done');
  r = await handle(s, ctx({ action: 'remove', id: e.id }));
  assert.deepEqual(r.body.entries, []);
  r = await handle(s, ctx(null, 'GET'));
  assert.deepEqual(r.body.entries, []);
});

test('validation', async () => {
  const s = fakeStore();
  assert.equal((await handle(s, ctx({ action: 'add', task: 'nope', name: 'x' }))).status, 400);
  assert.equal((await handle(s, ctx({ action: 'add', task: 'qa', name: '   ' }))).status, 400);
  assert.equal((await handle(s, ctx({ action: 'status', id: 'missing', status: 'done' }))).status, 404);
  assert.equal((await handle(s, ctx({ action: 'status', id: 'x', status: 'weird' }))).status, 400);
  assert.equal((await handle(s, ctx({ action: 'remove', id: 'missing' }))).status, 404);
  assert.equal((await handle(s, ctx({}, 'DELETE'))).status, 405);
  const long = 'a'.repeat(200);
  const r = await handle(s, ctx({ action: 'add', task: 'qa', name: long, part: long + '\n<b>' }));
  assert.equal(r.body.entries[0].name.length, LIMITS.name);
  assert.equal(r.body.entries[0].part.length, LIMITS.part);
});

test('rate limit', async () => {
  const s = fakeStore();
  let last;
  for (let i = 0; i <= LIMITS.writesPerWindow; i++) last = await handle(s, ctx({ action: 'add', task: 'qa', name: 'n' + i }));
  assert.equal(last.status, 429);
});
