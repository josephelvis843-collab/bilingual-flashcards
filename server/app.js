import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { WORDS, wordKey } from '../src/data/words.js';

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

// Builds the app without starting it. Passing in the store means tests
// can use a fake one and never touch a real database.
export function createApp({
  store,
  corsOrigin,
  trustProxyHops = 0,
  readLimit = 1000,
  writeLimit = 600,
}) {
  const app = express();

  // Behind a host's proxies every request appears to come from the proxy.
  // This says how many proxies to trust when finding the visitor's real IP.
  // Too high would let visitors fake their IP to dodge the rate limits.
  app.set('trust proxy', trustProxyHops);

  // In production the frontend (GitHub Pages) is on a different origin than
  // this API, so the browser blocks responses unless we allow that origin.
  // Locally, Vite's proxy makes requests same-origin, so CORS isn't needed.
  if (corsOrigin) {
    app.use(cors({ origin: corsOrigin.split(',') }));
  }

  const readLimiter = createLimiter(readLimit);
  const writeLimiter = createLimiter(writeLimit);

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/words', readLimiter, (req, res) => {
    res.json(WORDS);
  });

  // Express 5 forwards errors thrown in async handlers to the error
  // handler below automatically, so no try/catch is needed here.
  app.get('/api/progress', readLimiter, requireUserId, async (req, res) => {
    res.json({ known: await store.readKnown(req.userId) });
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
    await store.writeKnown(req.userId, unique);
    res.json({ known: unique });
  });

  // Error handler (4 arguments is how Express recognizes it). Bad requests
  // like malformed JSON are the client's mistake. Anything else is logged
  // for us, but the client only gets a generic message.
  app.use((err, req, res, _next) => {
    if (err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({ error: 'Invalid request' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
