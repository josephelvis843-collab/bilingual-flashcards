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
  const [flipped, setFlipped] = useState(false);

  return (
    // Clicking anywhere on the card toggles flipped. Note the function:
    // () => setFlipped(!flipped) — we pass a function to onClick, not the
    // result of calling it. If you wrote onClick={setFlipped(!flipped)}
    // it would fire immediately on render instead of on click.
    <div
      className={`flashcard ${flipped ? 'is-flipped' : ''}`}
      onClick={() => setFlipped(!flipped)}
    >
      <div className="flashcard-inner">
        <div className="flashcard-face">
          <p className="flashcard-category">{word.category}</p>
          <p className="flashcard-word">{word.en}</p>
          <p className="flashcard-hint">Click to flip</p>
        </div>
        <div className="flashcard-face flashcard-back">
          <p className="flashcard-category">{word.category}</p>
          <p className="flashcard-word">{word.es}</p>
          <p className="flashcard-hint">Click to flip back</p>
        </div>
      </div>
    </div>
  );
}
