import express from 'express';
import { WORDS, wordKey } from '../src/data/words.js';
import { readKnown, writeKnown } from './progressStore.js';

const app = express();
const PORT = process.env.PORT || 3001; // hosts like Render set PORT for you

// Parses JSON request bodies into req.body (needed for PUT /api/progress).
app.use(express.json());

const VALID_KEYS = new Set(WORDS.map(wordKey));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/words', (req, res) => {
  res.json(WORDS);
});

// Express 5 forwards errors thrown in async handlers to its error
// handler automatically, so no try/catch is needed here.
app.get('/api/progress', async (req, res) => {
  res.json({ known: await readKnown() });
});

// PUT replaces the whole resource: the client sends the full list of
// known word keys, and that becomes the saved progress.
app.put('/api/progress', async (req, res) => {
  const { known } = req.body ?? {};
  // Never trust the client — check the shape before saving anything.
  if (!Array.isArray(known) || !known.every(k => typeof k === 'string' && VALID_KEYS.has(k))) {
    return res.status(400).json({ error: '`known` must be an array of valid word keys' });
  }
  const unique = [...new Set(known)];
  await writeKnown(unique);
  res.json({ known: unique });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
