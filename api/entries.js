import { randomUUID } from 'node:crypto';
import { createStore } from '../lib/store.js';
import { handle } from '../lib/entries.js';

let store;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    store ??= createStore();
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : (forwarded || '')).split(',')[0].trim() || req.socket?.remoteAddress;
    const result = await handle(store, { method: req.method, body: req.body, ip, newId: randomUUID });
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
}
