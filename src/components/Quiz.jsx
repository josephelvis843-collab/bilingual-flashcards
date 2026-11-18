import { useEffect, useRef, useState } from 'react';

// A plain JS function — not a component, doesn't return JSX, just data.
// Not every function in a React file needs to be a component.
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Builds one random multiple-choice question: picks a word, picks a
// direction (asking for the English or the Spanish), then grabs 3
// wrong answers from the rest of the list.
function makeQuestion(words) {
  const questionWord = words[Math.floor(Math.random() * words.length)];
  const askEnglish = Math.random() < 0.5;
  const prompt = askEnglish ? questionWord.en : questionWord.es;
  const correctAnswer = askEnglish ? questionWord.es : questionWord.en;

  const distractors = shuffle(words.filter(w => w !== questionWord))
    .slice(0, 3)
    .map(w => (askEnglish ? w.es : w.en));

  return {
    prompt,
    correctAnswer,
    askEnglish,
    options: shuffle([correctAnswer, ...distractors]),
  };
}

// A self-contained quiz. It manages its own question and its own
// "have they answered yet" state — App doesn't need to know any of
// this, which is the point of splitting UI into components.
export default function Quiz({ words }) {
  const [question, setQuestion] = useState(() => makeQuestion(words));
  const [selected, setSelected] = useState(null); // which option they clicked, or null
  const questionRef = useRef(null);
  const shouldFocusQuestion = useRef(false);

  // The "Next question" button disappears once clicked, which would drop
  // keyboard users back at the top of the page. Move focus to the new
  // question instead — but only after a click, never on first page load.
  useEffect(() => {
    if (shouldFocusQuestion.current) {
      shouldFocusQuestion.current = false;
      questionRef.current.focus();
    }
  }, [question]);

  function handleAnswer(option) {
    if (selected) return; // already answered this question, ignore further clicks
    setSelected(option);
  }

  function nextQuestion() {
    shouldFocusQuestion.current = true;
    setQuestion(makeQuestion(words));
    setSelected(null);
  }

  // The answers are in the opposite language from the prompt. The lang
  // attribute tells screen readers which pronunciation to use.
  const promptLang = question.askEnglish ? 'en' : 'es';
  const answerLang = question.askEnglish ? 'es' : 'en';

  return (
    <div className="quiz-section">
      <p className="quiz-question" ref={questionRef} tabIndex={-1}>
        What is "<span lang={promptLang}>{question.prompt}</span>" in {question.askEnglish ? 'Spanish' : 'English'}?
      </p>
      <div className="quiz-options">
        {/* Rendering a list: .map turns each option string into a button.
            React needs a `key` on each item in a list so it can track
            which is which across re-renders — here the option text
            itself is unique enough to use. */}
        {question.options.map(option => {
          // Conditional (ternary) logic to decide each button's styling
          // once an answer has been picked.
          let className = 'quiz-option';
          if (selected) {
            if (option === question.correctAnswer) className += ' is-correct';
            else if (option === selected) className += ' is-wrong';
          }
          return (
            <button
              key={option}
              className={className}
              lang={answerLang}
              disabled={!!selected}
              onClick={() => handleAnswer(option)}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* Conditional rendering: the feedback only exists once `selected`
          is truthy. `selected && (...)` is a common React shorthand for
          "render this, or render nothing." The aria-live wrapper is always
          on the page so screen readers notice the text appearing inside it. */}
      <div aria-live="polite">
        {selected && (
          <p className="quiz-feedback">
            {selected === question.correctAnswer
              ? 'Correct! 🎉'
              : `Not quite — the answer was "${question.correctAnswer}".`}
          </p>
        )}
      </div>
      {/* Answering disables the option that had focus, so autoFocus moves
          keyboard users straight to the next step. */}
      {selected && (
        <button className="quiz-next" onClick={nextQuestion} autoFocus>Next question →</button>
      )}
    </div>
  );
}
