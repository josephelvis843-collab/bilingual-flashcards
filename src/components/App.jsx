import { useEffect, useState } from 'react';
import Flashcard from './Flashcard.jsx';
import Quiz from './Quiz.jsx';
import { WORDS, wordKey } from '../data/words.js';
import { fetchServerData, readLocalKnown, recordLocalChange, reconcileKnown, syncToServer } from '../api.js';

const STATUS_TEXT = {
  connecting: 'Connecting to server… (the free server can take up to a minute to wake up)',
  online: 'Progress saved to server',
  offline: 'Offline mode — progress saved in this browser',
};

// The top-level component. It owns which card we're looking at —
// that's "state lifted up": the index lives here, not inside Flashcard,
// because both the nav buttons AND the card need to know about it.
export default function App() {
  // Start with the bundled words and the local copy of progress, so the
  // app is usable immediately while the server (maybe) wakes up.
  const [words, setWords] = useState(WORDS);
  const [known, setKnown] = useState(() => new Set(readLocalKnown()));
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'online' | 'offline'
  const [saveError, setSaveError] = useState(false);
  const [index, setIndex] = useState(0);

  // Fetch once on mount (empty dependency array). useEffect is the right
  // place for this: loading data is syncing with something outside React.
  // The `cancelled` flag stops a late response from setting state after
  // the component is gone (React's StrictMode mounts twice in dev).
  useEffect(() => {
    let cancelled = false;
    fetchServerData()
      .then(data => {
        if (cancelled) return;
        setWords(data.words);
        const { known: reconciled, needsUpload } = reconcileKnown(data.known);
        setKnown(new Set(reconciled));
        if (needsUpload) {
          // The server rejects unknown keys, so leave out any words that
          // have been removed from the list since this was saved.
          const validKeys = new Set(data.words.map(wordKey));
          syncToServer(reconciled.filter(k => validKeys.has(k))).then(ok => setSaveError(!ok));
        }
        setStatus('online');
      })
      .catch(() => {
        if (!cancelled) setStatus('offline');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const word = words[index];

  // Wrap around: going back from card 0 lands on the last card, and
  // going forward from the last card wraps to 0. The % (modulo) plus
  // + words.length trick avoids ever landing on a negative index.
  function step(delta) {
    setIndex((index + delta + words.length) % words.length);
  }

  function markKnown(isKnown) {
    // Never mutate state directly (no known.add(...)) — build a new
    // Set and hand THAT to setKnown, so React knows something changed.
    const next = new Set(known);
    if (isKnown) next.add(wordKey(word));
    else next.delete(wordKey(word));
    setKnown(next);
    step(1);

    // Saving happens right here in the event handler, because it's caused
    // by a specific click — not something that should run after any render.
    const list = [...next];
    recordLocalChange(list); // if we're not online yet, this syncs on a later load
    if (status === 'online') {
      syncToServer(list).then(ok => setSaveError(!ok));
    }
  }

  const knownCount = words.filter(w => known.has(wordKey(w))).length;
  const pct = Math.round((knownCount / words.length) * 100);

  return (
    <main>
      <h1>Bilingual Vocab Flashcards</h1>

      <div className="progress-row">
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Words known"
          aria-valuemin={0}
          aria-valuemax={words.length}
          aria-valuenow={knownCount}
        >
          <div className="progress-fill" style={{ width: `${pct}%` }}></div>
        </div>
        <p className="progress-label">{knownCount} of {words.length} known</p>
      </div>
      <p className="status-note" role="status">{STATUS_TEXT[status]}</p>
      {saveError && (
        <p className="status-note is-error" role="alert">Couldn't reach the server. Your progress is saved in this browser and will sync later.</p>
      )}

      <div className="card-stage">
        <button className="card-nav" aria-label="Previous card" onClick={() => step(-1)}>‹</button>

        {/* key={index} is the important bit: when index changes, React
            sees a different key and throws away the old Flashcard
            instance instead of reusing it — which resets its internal
            `flipped` state back to false automatically. Without this,
            flipping card 1 and then hitting "next" would show card 2
            already flipped. */}
        <Flashcard key={index} word={word} />

        <button className="card-nav" aria-label="Next card" onClick={() => step(1)}>›</button>
      </div>
      <p className="card-counter" aria-live="polite">Card {index + 1} of {words.length}</p>

      <div className="know-actions">
        <button className="btn" onClick={() => markKnown(false)}>Still learning</button>
        <button className="btn btn-primary" onClick={() => markKnown(true)}>I know it</button>
      </div>

      <Quiz words={words} />
    </main>
  );
}
