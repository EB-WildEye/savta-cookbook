import { Redis } from '@upstash/redis';

/* Works with both variable names the Vercel Marketplace (Upstash) integration may inject. */
export function createStore() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Missing Redis credentials: connect an Upstash Redis database to this Vercel project.');
  // Values are stored as JSON strings on purpose; keep the client from re-parsing them.
  return new Redis({ url, token, automaticDeserialization: false });
}
