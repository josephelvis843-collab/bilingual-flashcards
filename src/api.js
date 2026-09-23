// All talking to the backend happens here, so components never call
// fetch directly. localStorage always keeps a copy of progress, so the
// app works instantly on load and even with no API at all.

// Empty in dev (Vite proxies /api to the Express server). The production
// build sets VITE_API_URL to the hosted API, e.g. https://my-api.onrender.com
const API_BASE = import.meta.env.VITE_API_URL ?? '';
const KNOWN_KEY = 'vocab-flashcards-known-react-v1';
const USER_ID_KEY = 'vocab-flashcards-user-id';

// Free hosts sleep when idle and can take ~50s to wake up.
const REQUEST_TIMEOUT_MS = 90_000;

// Each browser gets a random anonymous ID the first time, and reuses it
// after that. The server stores progress per ID.
let userId;
function getUserId() {
  if (userId) return userId;
  try {
    userId = localStorage.getItem(USER_ID_KEY);
  } catch {
    // localStorage unavailable — fall through and use a per-session ID
  }
  if (!userId) {
    userId = crypto.randomUUID();
    try {
      localStorage.setItem(USER_ID_KEY, userId);
    } catch {
      // ignore
    }
  }
  return userId;
}

async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-User-Id': getUserId() },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  // A static host answers /api/... with an HTML 404 page, so check both
  // the status and that we actually got JSON back.
  if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`API request failed: ${res.status}`);
  }
  return res.json();
}

export function readLocalKnown() {
  try {
    const raw = localStorage.getItem(KNOWN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return []; // localStorage can fail (private browsing, etc.)
  }
}

export function saveLocalKnown(known) {
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify(known));
  } catch {
    // ignore — app still works, it just won't persist
  }
}

export async function fetchServerData() {
  const [words, progress] = await Promise.all([
    request('/api/words'),
    request('/api/progress'),
  ]);
  return { words, known: progress.known };
}

export function saveServerKnown(known) {
  return request('/api/progress', {
    method: 'PUT',
    body: JSON.stringify({ known }),
  });
}
