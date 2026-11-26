import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { createQueryClient } from './query-client';
import { SessionProvider } from './session/session';
import { fakeApi, json, keys } from './test/fake-api';

const KEYS = {
  wzs_admin: { name: 'Gábor', level: 'admin' as const },
  wzs_phone: { name: 'Telefon', level: 'control' as const },
};

const STATE = {
  summary: { total: 12, online: 11, on: 2, brightness: 64.5, colorTemp: null },
  rooms: [],
  unassigned: [],
};

function renderApp(path = '/') {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <SessionProvider>
          <App />
        </SessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/app/');
  });

  it('asks for a key when none is stored', async () => {
    fakeApi({});
    renderApp();
    expect(await screen.findByLabelText('API-kulcs')).toBeTruthy();
  });

  it('signs in with a valid key and remembers it', async () => {
    const requests = fakeApi({
      'GET /api-keys/me': keys(KEYS),
      'GET /state': () => json(STATE),
    });
    renderApp();

    await userEvent.type(
      await screen.findByLabelText('API-kulcs'),
      'wzs_admin',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Belépés' }));

    expect(await screen.findByRole('heading', { name: 'Otthon' })).toBeTruthy();
    expect(await screen.findByText('11/12')).toBeTruthy();
    expect(screen.getByText('65%')).toBeTruthy();
    expect(localStorage.getItem('wizsla.apiKey')).toBe('wzs_admin');
    const stateCall = requests.find((r) => r.url.endsWith('/state'));
    expect(stateCall?.headers.get('X-API-Key')).toBe('wzs_admin');
  });

  it('refuses an invalid key', async () => {
    fakeApi({ 'GET /api-keys/me': keys(KEYS) });
    renderApp();

    await userEvent.type(
      await screen.findByLabelText('API-kulcs'),
      'wzs_wrong',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Belépés' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Érvénytelen vagy visszavont kulcs.',
    );
    expect(localStorage.getItem('wizsla.apiKey')).toBeNull();
  });

  it('takes the key from a sign-in link and removes it from the address', async () => {
    fakeApi({
      'GET /api-keys/me': keys(KEYS),
      'GET /state': () => json(STATE),
    });
    window.history.replaceState(null, '', '/app/#key=wzs_phone');
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Otthon' })).toBeTruthy();
    expect(window.location.hash).toBe('');
    expect(localStorage.getItem('wizsla.apiKey')).toBe('wzs_phone');
  });

  it('shows the admin section to admin keys only', async () => {
    fakeApi({ 'GET /api-keys/me': keys(KEYS) });
    localStorage.setItem('wizsla.apiKey', 'wzs_phone');
    const { unmount } = renderApp('/settings');
    expect(await screen.findByText('Telefon')).toBeTruthy();
    expect(screen.getByText('Jogosultság: vezérlés')).toBeTruthy();
    expect(screen.queryByText('Adminisztráció')).toBeNull();
    unmount();

    localStorage.setItem('wizsla.apiKey', 'wzs_admin');
    renderApp('/settings');
    expect(await screen.findByText('Adminisztráció')).toBeTruthy();
  });

  it('signs out', async () => {
    fakeApi({ 'GET /api-keys/me': keys(KEYS) });
    localStorage.setItem('wizsla.apiKey', 'wzs_admin');
    renderApp('/settings');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Kijelentkezés' }),
    );
    expect(await screen.findByLabelText('API-kulcs')).toBeTruthy();
    expect(localStorage.getItem('wizsla.apiKey')).toBeNull();
  });

  it('signs out when the key is revoked meanwhile', async () => {
    fakeApi({
      'GET /api-keys/me': keys(KEYS),
      'GET /state': () => json({ message: 'Invalid or revoked API key' }, 401),
    });
    localStorage.setItem('wizsla.apiKey', 'wzs_admin');
    renderApp();

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /visszavonták/,
    );
    expect(localStorage.getItem('wizsla.apiKey')).toBeNull();
  });

  it('keeps the stored key when the API cannot be reached', async () => {
    fakeApi({
      'GET /api-keys/me': () => Promise.reject(new TypeError('offline')),
    });
    localStorage.setItem('wizsla.apiKey', 'wzs_admin');
    renderApp();

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /nem érhető el/,
    );
    expect(screen.getByRole('button', { name: 'Újra' })).toBeTruthy();
    expect(localStorage.getItem('wizsla.apiKey')).toBe('wzs_admin');
  });
});
