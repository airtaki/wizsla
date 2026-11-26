import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { setApiKey, setUnauthorizedHandler } from '../api/client';

// Testing Library unmounts on its own only with Vitest globals, which this
// project does not use.
afterEach(() => {
  cleanup();
  setApiKey(null);
  setUnauthorizedHandler(null);
});
