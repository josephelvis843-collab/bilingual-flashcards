import { useState } from 'react';

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

  function handleAnswer(option) {
    if (selected) return; // already answered this question, ignore further clicks
    setSelected(option);
  }

  function nextQuestion() {
    setQuestion(makeQuestion(words));
    setSelected(null);
  }

  return (
    <div className="quiz-section">
      <p className="quiz-question">
        What is "{question.prompt}" in {question.askEnglish ? 'Spanish' : 'English'}?
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
              disabled={!!selected}
              onClick={() => handleAnswer(option)}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* Conditional rendering: this whole block only exists once
          `selected` is truthy. `selected && (...)` is a common React
          shorthand for "render this, or render nothing." */}
      {selected && (
        <div>
          <p className="quiz-feedback">
            {selected === question.correctAnswer
              ? 'Correct! 🎉'
              : `Not quite — the answer was "${question.correctAnswer}".`}
          </p>
          <button className="quiz-next" onClick={nextQuestion}>Next question →</button>
        </div>
      )}
    </div>
  );
}
