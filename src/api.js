// All talking to the backend happens here, so components never call
// fetch directly. If there's no API (e.g. the static GitHub Pages site),
// we fall back to the bundled word list and localStorage.
import { WORDS } from './data/words.js';

// Empty in dev (Vite proxies /api to the Express server). When the API is
// hosted elsewhere, set VITE_API_URL at build time, e.g. https://my-api.onrender.com
const API_BASE = import.meta.env.VITE_API_URL ?? '';
const STORAGE_KEY = 'vocab-flashcards-known-react-v1';

async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  // A static host answers /api/... with an HTML 404 page, so check both
  // the status and that we actually got JSON back.
  if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`API request failed: ${res.status}`);
  }
  return res.json();
}

function readLocalKnown() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return []; // localStorage can fail (private browsing, etc.)
  }
}

export function saveLocalKnown(known) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(known));
  } catch {
    // ignore — app still works, it just won't persist
  }
}

// Loads words + progress. `online` tells the app which place to save to.
export async function loadInitialData() {
  try {
    const [words, progress] = await Promise.all([
      request('/api/words'),
      request('/api/progress'),
    ]);
    return { words, known: progress.known, online: true };
  } catch {
    return { words: WORDS, known: readLocalKnown(), online: false };
  }
}

export function saveServerKnown(known) {
  return request('/api/progress', {
    method: 'PUT',
    body: JSON.stringify({ known }),
  });
}
