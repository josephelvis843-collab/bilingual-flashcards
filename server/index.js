import express from 'express';
import cors from 'cors';
import { WORDS, wordKey } from '../src/data/words.js';
import { init, readKnown, writeKnown, storeName } from './progressStore.js';

const app = express();
const PORT = process.env.PORT || 3001; // hosts like Render set PORT for you

// In production the frontend (GitHub Pages) is on a different origin than
// this API, so the browser blocks responses unless we allow that origin.
// Locally, Vite's proxy makes requests same-origin, so CORS isn't needed.
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(',') }));
}

// Parses JSON request bodies into req.body (needed for PUT /api/progress).
app.use(express.json());

const VALID_KEYS = new Set(WORDS.map(wordKey));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Middleware: runs before the progress routes. Each browser sends its
// anonymous ID in a header; we reject the request if it's missing or
// malformed, otherwise stash it on req for the route handler.
function requireUserId(req, res, next) {
  const id = req.get('X-User-Id');
  if (!id || !UUID_RE.test(id)) {
    return res.status(400).json({ error: 'Missing or invalid X-User-Id header' });
  }
  req.userId = id.toLowerCase();
  next();
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/words', (req, res) => {
  res.json(WORDS);
});

// Express 5 forwards errors thrown in async handlers to the error
// handler below automatically, so no try/catch is needed here.
app.get('/api/progress', requireUserId, async (req, res) => {
  res.json({ known: await readKnown(req.userId) });
});

// PUT replaces the whole resource: the client sends the full list of
// known word keys, and that becomes the saved progress.
app.put('/api/progress', requireUserId, async (req, res) => {
  const { known } = req.body ?? {};
  // Never trust the client — check the shape before saving anything.
  if (!Array.isArray(known) || !known.every(k => typeof k === 'string' && VALID_KEYS.has(k))) {
    return res.status(400).json({ error: '`known` must be an array of valid word keys' });
  }
  const unique = [...new Set(known)];
  await writeKnown(req.userId, unique);
  res.json({ known: unique });
});

// Error handler (4 arguments is how Express recognizes it). Logs the real
// error for us, but only sends a generic message to the client.
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

await init();
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT} (storage: ${storeName})`);
});
