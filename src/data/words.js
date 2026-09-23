// Same word list as the vanilla-JS version. Plain JS array/objects —
// React doesn't need anything special for your data.
export const WORDS = [
  { en: 'listen', es: 'escuchar', category: 'Classroom directions' },
  { en: 'raise your hand', es: 'levanta la mano', category: 'Classroom directions' },
  { en: 'sit down', es: 'siéntate', category: 'Classroom directions' },
  { en: 'add', es: 'sumar', category: 'Math terms' },
  { en: 'subtract', es: 'restar', category: 'Math terms' },
  { en: 'confused', es: 'confundido/a', category: 'Feelings & check-ins' },
  { en: 'proud', es: 'orgulloso/a', category: 'Feelings & check-ins' },
];

export function wordKey(word) {
  return `${word.category}::${word.en}`;
}
