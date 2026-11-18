import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { WORDS, wordKey } from '../data/words.js';

const KNOWN_KEY = 'vocab-flashcards-known-react-v1';
const ONLINE = 'Progress saved to server';
const total = WORDS.length;
const key = index => wordKey(WORDS[index]);

const jsonResponse = body => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => body,
});

// A pretend API. Returns the list of every save it receives.
function stubServer({ known = [], saveFails = false } = {}) {
  const saves = [];
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    if (options?.method === 'PUT') {
      saves.push(JSON.parse(options.body).known);
      return saveFails
        ? { ok: false, status: 500, headers: new Headers() }
        : jsonResponse({ known: saves.at(-1) });
    }
    return jsonResponse(url === '/api/words' ? WORDS : { known });
  }));
  return saves;
}

function stubServerDown() {
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new TypeError('network down');
  }));
}

// Lets any saves that were just started finish.
const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 0)));
const savedLocally = () => JSON.parse(localStorage.getItem(KNOWN_KEY));
const iKnowIt = () => screen.getByRole('button', { name: 'I know it' });

async function renderOnline() {
  const view = render(<App />);
  await screen.findByText(ONLINE);
  await settle();
  return view;
}

async function renderOffline() {
  stubServerDown();
  const view = render(<App />);
  await screen.findByText(/Offline mode/);
  return view;
}

describe('navigation', () => {
  it('moves between cards and wraps around at both ends', async () => {
    await renderOffline();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Previous card' }));
    expect(screen.getByText(`Card ${total} of ${total}`)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Next card' }));
    expect(screen.getByText(`Card 1 of ${total}`)).toBeTruthy();
  });

  it('shows the next card unflipped', async () => {
    await renderOffline();
    const user = userEvent.setup();

    await user.click(document.querySelector('.flashcard'));
    await user.click(screen.getByRole('button', { name: 'Next card' }));

    expect(document.querySelector('.flashcard').className).not.toContain('is-flipped');
  });
});

describe('progress', () => {
  it('counts known words and reports them on the progress bar', async () => {
    await renderOffline();
    const user = userEvent.setup();

    await user.click(iKnowIt());
    await user.click(iKnowIt());

    expect(screen.getByText(`2 of ${total} known`)).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Words known' }).getAttribute('aria-valuenow')).toBe('2');
  });

  it('removes a word marked as still learning', async () => {
    localStorage.setItem(KNOWN_KEY, JSON.stringify([key(0)]));
    await renderOffline();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Still learning' }));

    expect(screen.getByText(`0 of ${total} known`)).toBeTruthy();
  });

  it('keeps progress across a reload when offline', async () => {
    const first = await renderOffline();
    await userEvent.setup().click(iKnowIt());
    first.unmount();

    await renderOffline();

    expect(screen.getByText(`1 of ${total} known`)).toBeTruthy();
  });
});

describe('syncing with the server', () => {
  it('uses the server copy when this browser has nothing new', async () => {
    localStorage.setItem(KNOWN_KEY, JSON.stringify([key(3)]));
    const saves = stubServer({ known: [key(0), key(1)] });

    await renderOnline();

    expect(screen.getByText(`2 of ${total} known`)).toBeTruthy();
    expect(savedLocally()).toEqual([key(0), key(1)]);
    expect(saves).toHaveLength(0);
  });

  it('saves each change to the server', async () => {
    const saves = stubServer();
    await renderOnline();

    await userEvent.setup().click(iKnowIt());
    await settle();

    expect(saves).toEqual([[key(0)]]);
  });

  it('uses the server copy again after a successful save', async () => {
    stubServer();
    const first = await renderOnline();
    await userEvent.setup().click(iKnowIt());
    await settle();
    first.unmount();

    const saves = stubServer({ known: [key(1), key(2)] });
    await renderOnline();

    expect(screen.getByText(`2 of ${total} known`)).toBeTruthy();
    expect(saves).toHaveLength(0);
  });

  it('uploads words marked while offline instead of losing them', async () => {
    const first = await renderOffline();
    await userEvent.setup().click(iKnowIt());
    first.unmount();

    const saves = stubServer({ known: [key(5)] });
    await renderOnline();

    expect(screen.getByText(`1 of ${total} known`)).toBeTruthy();
    expect(savedLocally()).toEqual([key(0)]);
    expect(saves.at(-1)).toEqual([key(0)]);
  });

  it('shows an error when a save fails and retries on the next load', async () => {
    stubServer({ saveFails: true });
    const first = await renderOnline();
    await userEvent.setup().click(iKnowIt());
    expect((await screen.findByRole('alert')).textContent).toMatch(/Couldn't reach the server/);
    first.unmount();

    const saves = stubServer({ known: [key(5)] });
    await renderOnline();

    expect(saves.at(-1)).toEqual([key(0)]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps older browser-only progress when the server is empty', async () => {
    localStorage.setItem(KNOWN_KEY, JSON.stringify([key(3)]));
    const saves = stubServer({ known: [] });

    await renderOnline();

    expect(screen.getByText(`1 of ${total} known`)).toBeTruthy();
    expect(saves.at(-1)).toEqual([key(3)]);
  });

  it('does not upload words that no longer exist', async () => {
    localStorage.setItem(KNOWN_KEY, JSON.stringify(['Old category::gone', key(3)]));
    const saves = stubServer({ known: [] });

    await renderOnline();

    expect(saves.at(-1)).toEqual([key(3)]);
  });

  it('uploads clicks made while the server is waking up', async () => {
    let wakeUp;
    const awake = new Promise(resolve => {
      wakeUp = resolve;
    });
    const saves = [];
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      if (options?.method === 'PUT') {
        saves.push(JSON.parse(options.body).known);
        return jsonResponse({});
      }
      await awake;
      return jsonResponse(url === '/api/words' ? WORDS : { known: [key(5)] });
    }));

    render(<App />);
    await userEvent.setup().click(iKnowIt());
    wakeUp();
    await screen.findByText(ONLINE);
    await settle();

    expect(saves.at(-1)).toEqual([key(0)]);
    expect(screen.getByText(`1 of ${total} known`)).toBeTruthy();
  });

  it('sends one save at a time and finishes on the newest list', async () => {
    const finishSave = [];
    const saves = [];
    let running = 0;
    let mostAtOnce = 0;
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      if (options?.method !== 'PUT') {
        return jsonResponse(url === '/api/words' ? WORDS : { known: [] });
      }
      saves.push(JSON.parse(options.body).known);
      running += 1;
      mostAtOnce = Math.max(mostAtOnce, running);
      await new Promise(resolve => finishSave.push(resolve));
      running -= 1;
      return jsonResponse({});
    }));
    await renderOnline();
    const user = userEvent.setup();

    await user.click(iKnowIt());
    await user.click(iKnowIt());
    await user.click(iKnowIt());
    await waitFor(() => expect(finishSave.length).toBeGreaterThan(0));
    while (finishSave.length > 0) {
      finishSave.shift()();
      await settle();
    }

    expect(mostAtOnce).toBe(1);
    expect(saves.at(-1)).toEqual([key(0), key(1), key(2)]);
  });
});
