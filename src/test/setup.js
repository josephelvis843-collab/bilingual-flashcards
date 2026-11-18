import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Every test starts from a clean page, empty storage, and a real fetch.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
