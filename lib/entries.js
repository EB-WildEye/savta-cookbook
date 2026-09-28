/* Sign-up table logic, independent of Vercel and Redis so it can be tested with a fake store.
   A store needs: hgetall(key), hget(key, field), hset(key, obj), hdel(key, field), incr(key), expire(key, s). */
import { TASK_IDS, STATUSES } from '../content.js';

export const ENTRIES_KEY = 'cookbook:entries';
export const LIMITS = { name: 40, part: 80, maxEntries: 400, writesPerWindow: 60, windowSeconds: 600 };

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseEntry(raw) {
  if (raw && typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function listEntries(store) {
  const all = (await store.hgetall(ENTRIES_KEY)) || {};
  return Object.values(all).map(parseEntry).filter(Boolean).sort((a, b) => a.createdAt - b.createdAt);
}

function fail(status, error) { return { status, body: { error } }; }

async function withinRateLimit(store, ip) {
  const key = 'cookbook:rl:' + (ip || 'unknown');
  const count = await store.incr(key);
  if (count === 1) await store.expire(key, LIMITS.windowSeconds);
  return count <= LIMITS.writesPerWindow;
}

export async function handle(store, { method, body, ip, now = Date.now(), newId }) {
  if (method === 'GET') return { status: 200, body: { entries: await listEntries(store) } };
  if (method !== 'POST') return fail(405, 'method_not_allowed');
  if (!body || typeof body !== 'object') return fail(400, 'bad_request');
  if (!(await withinRateLimit(store, ip))) return fail(429, 'rate_limited');

  const { action } = body;

  if (action === 'add') {
    const task = body.task;
    const name = cleanText(body.name, LIMITS.name);
    const part = cleanText(body.part, LIMITS.part);
    const status = STATUSES.includes(body.status) ? body.status : 'todo';
    if (!TASK_IDS.includes(task)) return fail(400, 'unknown_task');
    if (!name) return fail(400, 'name_required');
    const current = await listEntries(store);
    if (current.length >= LIMITS.maxEntries) return fail(409, 'table_full');
    const entry = { id: newId(), task, name, part, status, createdAt: now, updatedAt: now };
    await store.hset(ENTRIES_KEY, { [entry.id]: JSON.stringify(entry) });
    return { status: 200, body: { entries: [...current, entry] } };
  }

  if (action === 'status') {
    if (!STATUSES.includes(body.status)) return fail(400, 'bad_status');
    const entry = parseEntry(await store.hget(ENTRIES_KEY, String(body.id || '')));
    if (!entry) return fail(404, 'not_found');
    const updated = { ...entry, status: body.status, updatedAt: now };
    await store.hset(ENTRIES_KEY, { [updated.id]: JSON.stringify(updated) });
    return { status: 200, body: { entries: await listEntries(store) } };
  }

  if (action === 'remove') {
    const removed = await store.hdel(ENTRIES_KEY, String(body.id || ''));
    if (!removed) return fail(404, 'not_found');
    return { status: 200, body: { entries: await listEntries(store) } };
  }

  return fail(400, 'unknown_action');
}
