// All talking to the backend happens here, so components never call
// fetch directly. localStorage always keeps a copy of progress, so the
// app works instantly on load and even with no API at all.

// Empty in dev (Vite proxies /api to the Express server). The production
// build sets VITE_API_URL to the hosted API, e.g. https://my-api.onrender.com
const API_BASE = import.meta.env.VITE_API_URL ?? '';
const KNOWN_KEY = 'vocab-flashcards-known-react-v1';
const USER_ID_KEY = 'vocab-flashcards-user-id';
const UNSYNCED_KEY = 'vocab-flashcards-unsynced-v1';

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
    const parsed = JSON.parse(localStorage.getItem(KNOWN_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // localStorage can fail (private browsing, etc.)
  }
}

function saveLocalKnown(known) {
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify(known));
  } catch {
    // ignore — app still works, it just won't persist
  }
}

// The "unsynced" flag means this browser has changes the server hasn't
// confirmed yet. It lives in localStorage so it survives a page reload.
function setUnsynced(isUnsynced) {
  try {
    if (isUnsynced) localStorage.setItem(UNSYNCED_KEY, 'true');
    else localStorage.removeItem(UNSYNCED_KEY);
  } catch {
    // ignore
  }
}

function hasUnsyncedChanges() {
  try {
    return localStorage.getItem(UNSYNCED_KEY) === 'true';
  } catch {
    return false;
  }
}

// Call on every user change: saves locally and remembers it still needs
// to reach the server, whatever the connection is doing right now.
export function recordLocalChange(known) {
  setUnsynced(true);
  saveLocalKnown(known);
}

export async function fetchServerData() {
  const [words, progress] = await Promise.all([
    request('/api/words'),
    request('/api/progress'),
  ]);
  return { words, known: progress.known };
}

// Decides whose progress wins when the server answers. The browser wins
// if it has unsynced changes, or if the server has nothing yet (progress
// from before the backend existed). Otherwise the server is the truth.
export function reconcileKnown(serverKnown) {
  const local = readLocalKnown();
  if (hasUnsyncedChanges() || (serverKnown.length === 0 && local.length > 0)) {
    return { known: local, needsUpload: true };
  }
  saveLocalKnown(serverKnown);
  return { known: serverKnown, needsUpload: false };
}

// Saves go out one at a time. Each one replaces the whole list, so if two
// ran at once the older list could land last and undo the newer one.
// Clicks during a save just update `queuedKnown`; only the newest is sent.
let queuedKnown = null;
let activeSync = null;

async function drainSaveQueue() {
  while (queuedKnown) {
    const known = queuedKnown;
    queuedKnown = null;
    await request('/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ known }),
    });
  }
  setUnsynced(false);
}

// Resolves to true once everything is saved, false if a save failed. On
// failure the unsynced flag stays set, so the next load uploads it again.
export function syncToServer(known) {
  queuedKnown = known;
  activeSync ??= drainSaveQueue()
    .then(() => true, () => false)
    .finally(() => {
      activeSync = null;
    });
  return activeSync;
}
