import { describe, expect, it, vi } from 'vitest';
import { WORDS } from './data/words.js';

const jsonResponse = body => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => body,
});

// api.js remembers the user ID in a variable, so a fresh import acts like a page reload.
async function loadApi() {
  vi.resetModules();
  return import('./api.js');
}

function stubServer() {
  const fetchMock = vi.fn(async url => jsonResponse(url === '/api/words' ? WORDS : { known: [] }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('api', () => {
  it('creates one anonymous ID and reuses it after a reload', async () => {
    const fetchMock = stubServer();

    await (await loadApi()).fetchServerData();
    await (await loadApi()).fetchServerData();

    const ids = fetchMock.mock.calls.map(([, options]) => options.headers['X-User-Id']);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('treats a static host\'s HTML page as a failed request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
    })));

    const api = await loadApi();

    await expect(api.fetchServerData()).rejects.toThrow('API request failed');
  });

  it('ignores corrupted saved progress', async () => {
    const api = await loadApi();

    localStorage.setItem('vocab-flashcards-known-react-v1', 'not json');
    expect(api.readLocalKnown()).toEqual([]);

    localStorage.setItem('vocab-flashcards-known-react-v1', '{"not":"a list"}');
    expect(api.readLocalKnown()).toEqual([]);
  });

  it('reports whether a save reached the server', async () => {
    const api = await loadApi();

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ known: [] })));
    await expect(api.syncToServer([])).resolves.toBe(true);

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('network down');
    }));
    await expect(api.syncToServer([])).resolves.toBe(false);
  });
});
