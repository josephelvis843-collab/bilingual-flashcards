import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { WORDS, wordKey } from '../src/data/words.js';
import { init, readKnown, writeKnown, storeName } from './progressStore.js';

const app = express();
const PORT = process.env.PORT || 3001; // hosts like Render set PORT for you

// Behind a host's proxies every request appears to come from the proxy.
// This says how many proxies to trust when finding the visitor's real IP.
// Too high would let visitors fake their IP to dodge the rate limits.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 0));

// In production the frontend (GitHub Pages) is on a different origin than
// this API, so the browser blocks responses unless we allow that origin.
// Locally, Vite's proxy makes requests same-origin, so CORS isn't needed.
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(',') }));
}

// Rate limits are per IP address. They're generous because a whole
// classroom can share one IP, but they stop a script from flooding the
// API or filling the free database. Over the limit, requests get a 429.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function createLimiter(limit) {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });
}

const readLimiter = createLimiter(1000);
const writeLimiter = createLimiter(600);

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

// TEMPORARY: measures Render's proxy chain. Shows callers only their own request.
app.get('/api/proxy-check', (req, res) => {
  res.json({
    forwardedFor: req.get('x-forwarded-for') ?? null,
    socket: req.socket.remoteAddress,
    ip: req.ip,
  });
});

app.get('/api/words', readLimiter, (req, res) => {
  res.json(WORDS);
});

// Express 5 forwards errors thrown in async handlers to the error
// handler below automatically, so no try/catch is needed here.
app.get('/api/progress', readLimiter, requireUserId, async (req, res) => {
  res.json({ known: await readKnown(req.userId) });
});

// PUT replaces the whole resource: the client sends the full list of
// known word keys, and that becomes the saved progress. The limiter runs
// before express.json() so blocked requests never get their body parsed.
app.put('/api/progress', writeLimiter, express.json(), requireUserId, async (req, res) => {
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
