import { useState } from 'react';

// This is a React *component*: a JS function that returns JSX (the
// HTML-looking syntax below). `word` here is a **prop** — data passed
// in from whoever uses <Flashcard />, the same way an HTML element
// takes attributes. Components are just reusable, parameterized templates.
export default function Flashcard({ word }) {
  // useState gives a component its own memory.
  // `flipped` is the current value; `setFlipped` is the ONLY way you're
  // allowed to change it. Calling setFlipped tells React "re-render this
  // component" — you never mutate flipped directly (no flipped = true).
  // It starts as null so nothing is announced until the first real flip.
  const [flipped, setFlipped] = useState(null);

  let announcement = '';
  if (flipped !== null) {
    announcement = flipped ? `Spanish: ${word.es}` : `English: ${word.en}`;
  }

  return (
    // A real <button> gets keyboard focus and Enter/Space support for free,
    // which a clickable <div> doesn't. Buttons may only contain inline
    // elements, so the card is built from <span>s styled in index.css.
    // Note the function: () => setFlipped(!flipped) — we pass a function to
    // onClick, not the result of calling it. If you wrote
    // onClick={setFlipped(!flipped)} it would fire immediately on render.
    <>
      <button
        type="button"
        className={`flashcard ${flipped ? 'is-flipped' : ''}`}
        onClick={() => setFlipped(!flipped)}
      >
        <span className="flashcard-inner">
          {/* aria-hidden hides the face you can't see from screen readers. */}
          <span className="flashcard-face" aria-hidden={Boolean(flipped)}>
            <span className="flashcard-category">{word.category}</span>
            <span className="flashcard-word" lang="en">{word.en}</span>
            <span className="flashcard-hint">Click or press Enter to flip</span>
          </span>
          <span className="flashcard-face flashcard-back" aria-hidden={!flipped}>
            <span className="flashcard-category">{word.category}</span>
            <span className="flashcard-word" lang="es">{word.es}</span>
            <span className="flashcard-hint">Click or press Enter to flip back</span>
          </span>
        </span>
      </button>
      {/* Invisible on screen; screen readers read out changes to it. */}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </>
  );
}
