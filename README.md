# Grandma Nurit - Klari's Cookbook - family task board

A static page (Hebrew / German / English) plus one serverless API that stores the sign-up table in Upstash Redis.
No login: anyone with the link can view, sign up, update a status or remove an entry.

## Files
- `index.html`, `styles.css`, `app.js`, `motifs.js` - the page
- `content.js` - all texts, tasks and tips (single source, also used by the API to validate task ids)
- `api/entries.js` - Vercel function: `GET` lists entries, `POST` with `action` = `add` | `status` | `remove`
- `lib/entries.js` - validation, rate limiting and storage logic (tested in `test/`)
- `lib/store.js` - Redis client
- `scripts/dev-server.js` - local preview with in-memory storage

## Deploy on Vercel
1. Push this folder to a GitHub repository.
2. In Vercel: Add New > Project > import the repository. Framework preset: **Other**. No build command.
3. Open the project's **Storage** tab > create or connect an **Upstash for Redis** database (Marketplace) and connect it to all environments.
   The function reads `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, or `KV_REST_API_URL` / `KV_REST_API_TOKEN` - whichever the integration injects.
4. Redeploy so the new environment variables are picked up, then share the project URL.

## Local
```
npm install
npm run dev    # http://localhost:3000, in-memory data (resets on restart)
npm test
```

## Notes
- Writes are limited to 60 per IP per 10 minutes; the table is capped at 400 entries.
- Everyone with the link can edit, so share it only with the family.
- To wipe the table, delete the key `cookbook:entries` in the Upstash console.
