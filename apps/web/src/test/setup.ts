import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { configureZodLocale } from '../shared/validation/zodLocale';

// Same zod locale as the app (`main.tsx`).
configureZodLocale();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
