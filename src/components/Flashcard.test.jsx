import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Flashcard from './Flashcard.jsx';

const word = { en: 'listen', es: 'escuchar', category: 'Classroom directions' };

function renderCard() {
  const { container } = render(<Flashcard word={word} />);
  return { user: userEvent.setup(), announcer: container.querySelector('[aria-live]') };
}

describe('Flashcard', () => {
  it('starts on the English side without announcing anything', () => {
    const { announcer } = renderCard();

    expect(screen.getByRole('button', { name: /listen/ }).className).not.toContain('is-flipped');
    expect(announcer.textContent).toBe('');
  });

  it('flips when clicked', async () => {
    const { user } = renderCard();

    await user.click(screen.getByRole('button'));

    expect(screen.getByRole('button').className).toContain('is-flipped');
  });

  it('can be reached with Tab and flipped with Enter and Space', async () => {
    const { user, announcer } = renderCard();

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button'));

    await user.keyboard('{Enter}');
    expect(screen.getByRole('button').className).toContain('is-flipped');
    expect(announcer.textContent).toBe('Spanish: escuchar');

    await user.keyboard(' ');
    expect(screen.getByRole('button').className).not.toContain('is-flipped');
    expect(announcer.textContent).toBe('English: listen');
  });

  it('exposes only the visible side to screen readers', async () => {
    const { user } = renderCard();
    const card = screen.getByRole('button');

    expect(screen.queryByRole('button', { name: /escuchar/ })).toBeNull();

    await user.click(card);

    expect(screen.getByRole('button', { name: /escuchar/ })).toBe(card);
    expect(screen.queryByRole('button', { name: /listen/ })).toBeNull();
  });

  it('marks each word with its language', () => {
    renderCard();

    expect(screen.getByText('listen').lang).toBe('en');
    expect(screen.getByText('escuchar').lang).toBe('es');
  });
});
