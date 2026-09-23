import { useEffect, useState } from 'react';
import Flashcard from './Flashcard.jsx';
import Quiz from './Quiz.jsx';
import { wordKey } from '../data/words.js';
import { loadInitialData, saveLocalKnown, saveServerKnown } from '../api.js';

// The top-level component. It owns which card we're looking at —
// that's "state lifted up": the index lives here, not inside Flashcard,
// because both the nav buttons AND the card need to know about it.
export default function App() {
  // null until loaded — words now come from the API (or the fallback list).
  const [words, setWords] = useState(null);
  const [known, setKnown] = useState(new Set());
  const [online, setOnline] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [index, setIndex] = useState(0);

  // Fetch once on mount (empty dependency array). useEffect is the right
  // place for this: loading data is syncing with something outside React.
  // The `cancelled` flag stops a late response from setting state after
  // the component is gone (React's StrictMode mounts twice in dev).
  useEffect(() => {
    let cancelled = false;
    loadInitialData().then(data => {
      if (cancelled) return;
      setWords(data.words);
      setKnown(new Set(data.known));
      setOnline(data.online);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!words) {
    return <p className="status-note">Loading words…</p>;
  }

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
    if (online) {
      saveServerKnown([...next])
        .then(() => setSaveError(false))
        .catch(() => setSaveError(true));
    } else {
      saveLocalKnown([...next]);
    }
  }

  const knownCount = words.filter(w => known.has(wordKey(w))).length;
  const pct = Math.round((knownCount / words.length) * 100);

  return (
    <div>
      <h1>Bilingual Vocab Flashcards</h1>

      <div className="progress-row">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }}></div>
        </div>
        <p className="progress-label">{knownCount} of {words.length} known</p>
      </div>
      <p className="status-note">
        {online ? 'Progress saved to server' : 'Offline mode — progress saved in this browser'}
      </p>
      {saveError && (
        <p className="status-note is-error">Couldn't save progress to the server. Is it running?</p>
      )}

      <div className="card-stage">
        <button className="card-nav" onClick={() => step(-1)}>‹</button>

        {/* key={index} is the important bit: when index changes, React
            sees a different key and throws away the old Flashcard
            instance instead of reusing it — which resets its internal
            `flipped` state back to false automatically. Without this,
            flipping card 1 and then hitting "next" would show card 2
            already flipped. */}
        <Flashcard key={index} word={word} />

        <button className="card-nav" onClick={() => step(1)}>›</button>
      </div>
      <p className="card-counter">Card {index + 1} of {words.length}</p>

      <div className="know-actions">
        <button className="btn" onClick={() => markKnown(false)}>Still learning</button>
        <button className="btn btn-primary" onClick={() => markKnown(true)}>I know it</button>
      </div>

      <Quiz words={words} />
    </div>
  );
}
