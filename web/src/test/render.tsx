import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from '../App';
import { ToastProvider } from '../components/toast';
import { createQueryClient } from '../query-client';
import { SessionProvider } from '../session/session';

/** The whole app at `path`, signed in with `key` (stored beforehand). */
export function renderApp(path = '/', key?: string) {
  if (key) localStorage.setItem('wizsla.apiKey', key);
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <SessionProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </SessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
