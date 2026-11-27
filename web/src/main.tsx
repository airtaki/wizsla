import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { ToastProvider } from './components/toast';
import { createQueryClient } from './query-client';
import { SessionProvider } from './session/session';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <BrowserRouter basename="/app">
        <SessionProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

// Browsers allow service workers on HTTPS (and localhost) only; on a plain
// http:// LAN address the app simply runs without one.
if (
  import.meta.env.PROD &&
  window.isSecureContext &&
  'serviceWorker' in navigator
) {
  void navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' });
}
