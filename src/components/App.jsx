import { useEffect, useState } from 'react';
import Flashcard from './Flashcard.jsx';
import Quiz from './Quiz.jsx';
import { WORDS, wordKey } from '../data/words.js';

const STORAGE_KEY = 'vocab-flashcards-known-react-v1';

// The top-level component. It owns which card we're looking at —
// that's "state lifted up": the index lives here, not inside Flashcard,
// because both the nav buttons AND the card need to know about it.
export default function App() {
  const [index, setIndex] = useState(0);
  const word = WORDS[index];

  // Lazy initial state: the function passed to useState only runs ONCE,
  // on the very first render — not on every re-render — which makes it
  // the right place for a one-time read from localStorage.
  const [known, setKnown] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set(); // localStorage can fail (private browsing, etc.) — fall back gracefully
    }
  });

  // useEffect runs *after* React renders, and re-runs whenever anything
  // in its dependency array ([known]) changes. This is the classic use
  // case: syncing React state to something outside React — here,
  // localStorage. We never call localStorage.setItem during render
  // itself, only inside an effect.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...known]));
    } catch {
      // ignore — app still works, it just won't persist
    }
  }, [known]);

  // Wrap around: going back from card 0 lands on the last card, and
  // going forward from the last card wraps to 0. The % (modulo) plus
  // + WORDS.length trick avoids ever landing on a negative index.
  function step(delta) {
    setIndex((index + delta + WORDS.length) % WORDS.length);
  }

  function markKnown(isKnown) {
    // Never mutate state directly (no known.add(...)) — build a new
    // Set and hand THAT to setKnown, so React knows something changed.
    const next = new Set(known);
    if (isKnown) next.add(wordKey(word));
    else next.delete(wordKey(word));
    setKnown(next);
    step(1);
  }

  const knownCount = WORDS.filter(w => known.has(wordKey(w))).length;
  const pct = Math.round((knownCount / WORDS.length) * 100);

  return (
    <div>
      <h1>Bilingual Vocab Flashcards</h1>

      <div className="progress-row">
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }}></div>
        </div>
        <p className="progress-label">{knownCount} of {WORDS.length} known</p>
      </div>

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
      <p className="card-counter">Card {index + 1} of {WORDS.length}</p>

      <div className="know-actions">
        <button className="btn" onClick={() => markKnown(false)}>Still learning</button>
        <button className="btn btn-primary" onClick={() => markKnown(true)}>I know it</button>
      </div>

      <Quiz words={WORDS} />
    </div>
  );
}
