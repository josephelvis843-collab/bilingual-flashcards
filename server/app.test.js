import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { WORDS, wordKey } from '../src/data/words.js';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const key = index => wordKey(WORDS[index]);

// Stands in for the database, so these tests never touch real data.
function memoryStore() {
  const users = new Map();
  return {
    readKnown: async userId => users.get(userId) ?? [],
    writeKnown: async (userId, known) => {
      users.set(userId, known);
    },
  };
}

const testApp = (options = {}) => createApp({ store: memoryStore(), ...options });
const save = (app, userId, known) => request(app)
  .put('/api/progress')
  .set('X-User-Id', userId)
  .send({ known });
const load = (app, userId) => request(app).get('/api/progress').set('X-User-Id', userId);

describe('public routes', () => {
  it('reports health', async () => {
    const res = await request(testApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('returns the word list', async () => {
    const res = await request(testApp()).get('/api/words');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(WORDS);
  });
});

describe('progress', () => {
  it('starts empty for a new visitor', async () => {
    const res = await load(testApp(), USER_A);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ known: [] });
  });

  it('saves and returns progress', async () => {
    const app = testApp();

    await save(app, USER_A, [key(0), key(1)]);

    expect((await load(app, USER_A)).body.known).toEqual([key(0), key(1)]);
  });

  it('replaces the old list on each save', async () => {
    const app = testApp();

    await save(app, USER_A, [key(0), key(1)]);
    await save(app, USER_A, [key(1)]);

    expect((await load(app, USER_A)).body.known).toEqual([key(1)]);
  });

  it('removes duplicates', async () => {
    const res = await save(testApp(), USER_A, [key(0), key(0)]);

    expect(res.body.known).toEqual([key(0)]);
  });

  it('keeps each visitor\'s progress separate', async () => {
    const app = testApp();

    await save(app, USER_A, [key(0)]);

    expect((await load(app, USER_B)).body.known).toEqual([]);
  });

  it('treats upper and lower case IDs as the same visitor', async () => {
    const app = testApp();
    const id = 'abcdefab-1111-4111-8111-111111111111';

    await save(app, id.toUpperCase(), [key(0)]);

    expect((await load(app, id)).body.known).toEqual([key(0)]);
  });
});

describe('rejecting bad requests', () => {
  it.each([
    ['missing', undefined],
    ['malformed', 'not-a-uuid'],
  ])('rejects a %s visitor ID', async (_label, id) => {
    const req = request(testApp()).get('/api/progress');
    const res = await (id ? req.set('X-User-Id', id) : req);

    expect(res.status).toBe(400);
  });

  it.each([
    ['an unknown word', { known: ['Old category::gone'] }],
    ['a non-text value', { known: [42] }],
    ['a non-list value', { known: 'everything' }],
    ['no list at all', {}],
  ])('rejects %s without saving', async (_label, body) => {
    const app = testApp();
    await save(app, USER_A, [key(0)]);

    const res = await request(app).put('/api/progress').set('X-User-Id', USER_A).send(body);

    expect(res.status).toBe(400);
    expect((await load(app, USER_A)).body.known).toEqual([key(0)]);
  });

  it('answers malformed JSON with a 400', async () => {
    const res = await request(testApp())
      .put('/api/progress')
      .set('X-User-Id', USER_A)
      .set('Content-Type', 'application/json')
      .send('{"known":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid request' });
  });

  it('hides internal error details from the client', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = {
      ...memoryStore(),
      readKnown: async () => {
        throw new Error('database password is hunter2');
      },
    };

    const res = await load(testApp({ store }), USER_A);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

describe('rate limits', () => {
  it('uses the production limits by default', async () => {
    const app = testApp();

    const read = await request(app).get('/api/words');
    const write = await save(app, USER_A, []);

    expect(read.headers.ratelimit).toContain('r=999');
    expect(read.headers['ratelimit-policy']).toContain('q=1000');
    expect(write.headers.ratelimit).toContain('r=599');
    expect(write.headers['ratelimit-policy']).toContain('q=600');
  });

  it('blocks reads over the limit with a readable error', async () => {
    const app = testApp({ readLimit: 2 });

    await request(app).get('/api/words');
    await load(app, USER_A);
    const blocked = await request(app).get('/api/words');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many requests/);
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('blocks writes over the limit without saving', async () => {
    const app = testApp({ writeLimit: 1 });

    await save(app, USER_A, [key(0)]);
    const blocked = await save(app, USER_A, [key(1)]);

    expect(blocked.status).toBe(429);
    expect((await load(app, USER_A)).body.known).toEqual([key(0)]);
  });

  it('counts reads and writes separately', async () => {
    const app = testApp({ writeLimit: 1 });

    await save(app, USER_A, []);
    await save(app, USER_A, []);

    expect((await request(app).get('/api/words')).status).toBe(200);
  });

  it('never limits the health check', async () => {
    const app = testApp({ readLimit: 1, writeLimit: 1 });

    await request(app).get('/api/health');
    await request(app).get('/api/health');

    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  describe('behind Render\'s three proxies', () => {
    const chain = client => `${client}, 172.71.102.7, 10.28.117.134`;
    const getWords = (app, forwardedFor) => request(app).get('/api/words').set('X-Forwarded-For', forwardedFor);

    it('gives each visitor their own allowance', async () => {
      const app = testApp({ trustProxyHops: 3, readLimit: 1 });

      await getWords(app, chain('198.51.100.1'));

      expect((await getWords(app, chain('198.51.100.1'))).status).toBe(429);
      expect((await getWords(app, chain('198.51.100.2'))).status).toBe(200);
    });

    it('cannot be bypassed by faking an IP', async () => {
      const app = testApp({ trustProxyHops: 3, readLimit: 1 });

      await getWords(app, chain('198.51.100.1'));
      const faked = await getWords(app, `203.0.113.77, ${chain('198.51.100.1')}`);

      expect(faked.status).toBe(429);
    });
  });
});

describe('CORS', () => {
  const SITE = 'https://josephelvis843-collab.github.io';
  const preflight = (app, origin) => request(app)
    .options('/api/progress')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'PUT')
    .set('Access-Control-Request-Headers', 'content-type,x-user-id');

  it('allows the live site', async () => {
    const res = await preflight(testApp({ corsOrigin: SITE }), SITE);

    expect(res.headers['access-control-allow-origin']).toBe(SITE);
    expect(res.headers['access-control-allow-headers']).toContain('x-user-id');
  });

  it('does not allow other websites', async () => {
    const res = await preflight(testApp({ corsOrigin: SITE }), 'https://evil.example.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('still allows the live site to read a rate limit error', async () => {
    const app = testApp({ corsOrigin: SITE, readLimit: 1 });

    await request(app).get('/api/words').set('Origin', SITE);
    const blocked = await request(app).get('/api/words').set('Origin', SITE);

    expect(blocked.status).toBe(429);
    expect(blocked.headers['access-control-allow-origin']).toBe(SITE);
  });
});
