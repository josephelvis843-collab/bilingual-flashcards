import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Quiz from './Quiz.jsx';
import { WORDS } from '../data/words.js';

// Questions are random, so work out the right answer from the prompt on screen.
function correctAnswer() {
  const prompt = document.querySelector('.quiz-question span').textContent;
  const word = WORDS.find(w => w.en === prompt || w.es === prompt);
  return word.en === prompt ? word.es : word.en;
}

const options = () => [...document.querySelectorAll('.quiz-option')];
const optionText = text => options().find(option => option.textContent === text);
const wrongOption = () => options().find(option => option.textContent !== correctAnswer());

function renderQuiz() {
  render(<Quiz words={WORDS} />);
  return userEvent.setup();
}

describe('Quiz', () => {
  it('offers four different answers including the right one', () => {
    renderQuiz();

    const answers = options().map(option => option.textContent);
    expect(new Set(answers).size).toBe(4);
    expect(answers).toContain(correctAnswer());
  });

  it('confirms a correct answer', async () => {
    const user = renderQuiz();

    await user.click(optionText(correctAnswer()));

    expect(screen.getByText(/Correct!/)).toBeTruthy();
    expect(optionText(correctAnswer()).className).toContain('is-correct');
  });

  it('shows the right answer after a wrong one', async () => {
    const user = renderQuiz();
    const answer = correctAnswer();
    const wrong = wrongOption();

    await user.click(wrong);

    expect(screen.getByText(`Not quite — the answer was "${answer}".`)).toBeTruthy();
    expect(wrong.className).toContain('is-wrong');
    expect(optionText(answer).className).toContain('is-correct');
  });

  it('locks the answers once one is chosen', async () => {
    const user = renderQuiz();

    await user.click(options()[0]);

    expect(options().every(option => option.disabled)).toBe(true);
  });

  it('puts feedback in a region screen readers announce', async () => {
    const user = renderQuiz();

    await user.click(options()[0]);

    expect(document.querySelector('.quiz-feedback').closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('does not take keyboard focus when the page loads', () => {
    renderQuiz();

    expect(document.activeElement).toBe(document.body);
  });

  it('keeps keyboard users in place through a full question', async () => {
    const user = renderQuiz();

    options()[0].focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Next question/ }));

    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(document.querySelector('.quiz-question'));
    expect(document.querySelector('.quiz-feedback')).toBeNull();

    await user.tab();
    expect(document.activeElement).toBe(options()[0]);
    expect(options()[0].disabled).toBe(false);
  });

  it('marks the prompt and answers with opposite languages', () => {
    renderQuiz();

    const promptLang = document.querySelector('.quiz-question span').lang;
    expect(['en', 'es']).toContain(promptLang);
    expect(options().every(option => option.lang === (promptLang === 'en' ? 'es' : 'en'))).toBe(true);
  });
});
