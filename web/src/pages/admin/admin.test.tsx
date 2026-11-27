import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeAdmin } from '../../test/admin-fixtures';
import { fakeApi } from '../../test/fake-api';
import { renderApp } from '../../test/render';

function start(path: string, key = 'wzs_admin') {
  const api = fakeAdmin();
  fakeApi(api.handlers);
  renderApp(path, key);
  return api;
}

describe('Administration', () => {
  beforeEach(() => localStorage.clear());

  it('offers the admin pages to an admin key only', async () => {
    start('/settings');
    expect(await screen.findByRole('link', { name: /Szobák/ })).toBeTruthy();
    expect(
      await screen.findByRole('link', { name: /Izzók.*1 szoba nélkül/ }),
    ).toBeTruthy();
  });

  it('sends a control key back from the admin pages', async () => {
    start('/settings/rooms', 'wzs_phone');
    expect(
      await screen.findByRole('heading', { name: 'Beállítások' }),
    ).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Szobák/ })).toBeNull();
  });

  describe('rooms', () => {
    it('creates a room at the end of the list', async () => {
      const api = start('/settings/rooms');
      await userEvent.click(
        await screen.findByRole('button', { name: 'Új szoba' }),
      );
      const dialog = screen.getByRole('dialog', { name: 'Új szoba' });
      await userEvent.type(within(dialog).getByLabelText('Név'), 'Étkező');
      // The slug it would get is shown as a hint.
      expect(within(dialog).getByPlaceholderText('etkezo')).toBeTruthy();
      await userEvent.click(
        within(dialog).getByRole('button', { name: 'Létrehozás' }),
      );

      await waitFor(() =>
        expect(api.changes).toEqual([
          {
            method: 'POST',
            path: '/rooms',
            body: { name: 'Étkező', sortOrder: 3 },
          },
        ]),
      );
      expect(await screen.findByText('„Étkező” létrehozva.')).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renames a room and keeps its slug', async () => {
      const api = start('/settings/rooms');
      await userEvent.click(
        await screen.findByRole('button', { name: 'Nappali szerkesztése' }),
      );
      const name = within(screen.getByRole('dialog')).getByLabelText('Név');
      await userEvent.clear(name);
      await userEvent.type(name, 'Nagyszoba');
      await userEvent.click(screen.getByRole('button', { name: 'Mentés' }));
      await waitFor(() =>
        expect(api.changes).toEqual([
          { method: 'PATCH', path: '/rooms/1', body: { name: 'Nagyszoba' } },
        ]),
      );
    });

    it('deletes a room after asking', async () => {
      const api = start('/settings/rooms');
      await userEvent.click(
        await screen.findByRole('button', { name: 'Nappali szerkesztése' }),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Szoba törlése' }),
      );
      const ask = screen.getByRole('dialog', { name: 'Törlöd: Nappali?' });
      expect(ask.textContent).toContain('Az izzói (1) megmaradnak');
      await userEvent.click(
        within(ask).getByRole('button', { name: 'Törlés' }),
      );
      await waitFor(() =>
        expect(api.changes).toEqual([{ method: 'DELETE', path: '/rooms/1' }]),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Nappali szerkesztése' }),
        ).toBeNull(),
      );
    });

    it('does not delete when the question is cancelled', async () => {
      const api = start('/settings/rooms');
      await userEvent.click(
        await screen.findByRole('button', { name: 'Háló szerkesztése' }),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Szoba törlése' }),
      );
      await userEvent.click(
        within(screen.getByRole('dialog', { name: 'Törlöd: Háló?' })).getByRole(
          'button',
          { name: 'Mégse' },
        ),
      );
      expect(api.changes).toEqual([]);
      // The room's own sheet is still open.
      expect(screen.getByRole('dialog', { name: 'Háló' })).toBeTruthy();
    });
  });

  describe('bulbs', () => {
    it('finds new bulbs and puts one in a room', async () => {
      const api = start('/settings/bulbs');
      await userEvent.click(
        await screen.findByRole('button', { name: 'Felderítés' }),
      );
      expect(await screen.findByText('1 új izzó, szoba nélkül')).toBeTruthy();
      expect(screen.getByText(/Nem válaszolt: Wiz 0002/)).toBeTruthy();
      expect(await screen.findByText('Új')).toBeTruthy();

      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: 'Wiz 0003 szobája' }),
        'Háló',
      );
      await waitFor(() =>
        expect(api.changes.at(-1)).toEqual({
          method: 'PATCH',
          path: '/bulbs/wiz-0003',
          body: { roomId: 2 },
        }),
      );
      expect(await screen.findByRole('heading', { name: 'Háló' })).toBeTruthy();
    });

    it('blinks a bulb to find it', async () => {
      const api = start('/settings/bulbs');
      await userEvent.click(
        await screen.findByRole('button', { name: 'Azonosít' }),
      );
      await waitFor(() =>
        expect(api.changes).toEqual([
          { method: 'POST', path: '/bulbs/wiz-0002/identify' },
        ]),
      );
      expect(await screen.findByText('„Wiz 0002” villog.')).toBeTruthy();
    });

    it('edits a bulb and takes it out of its room', async () => {
      const api = start('/settings/bulbs/allolampa');
      const name = await screen.findByLabelText('Név');
      expect(screen.getByText('a8:bb:50:00:00:01')).toBeTruthy();
      await userEvent.clear(name);
      await userEvent.type(name, 'Olvasólámpa');
      await userEvent.selectOptions(
        screen.getByLabelText('Szoba'),
        'Szoba nélkül',
      );
      await userEvent.click(
        screen.getByRole('switch', { name: 'Engedélyezve' }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Mentés' }));
      await waitFor(() =>
        expect(api.changes).toEqual([
          {
            method: 'PATCH',
            path: '/bulbs/1',
            body: {
              name: 'Olvasólámpa',
              slug: 'allolampa',
              roomId: null,
              enabled: false,
            },
          },
        ]),
      );
    });

    it('removes a bulb after asking, and goes back to the list', async () => {
      const api = start('/settings/bulbs/allolampa');
      await userEvent.click(
        await screen.findByRole('button', { name: 'Izzó eltávolítása' }),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Eltávolítás' }),
      );
      await waitFor(() =>
        expect(api.changes).toEqual([{ method: 'DELETE', path: '/bulbs/1' }]),
      );
      expect(
        await screen.findByRole('heading', { name: 'Izzók' }),
      ).toBeTruthy();
    });
  });

  describe('API keys', () => {
    it('creates a key and shows its sign-in QR code once', async () => {
      const api = start('/settings/keys');
      await userEvent.click(
        await screen.findByRole('button', { name: 'Új kulcs' }),
      );
      await userEvent.type(screen.getByLabelText('Kinek vagy minek?'), 'Anna');
      await userEvent.click(screen.getByRole('tab', { name: 'Olvasás' }));
      await userEvent.click(screen.getByRole('button', { name: 'Létrehozás' }));

      const done = await screen.findByRole('dialog', { name: 'Kész: Anna' });
      expect(api.changes[0]).toEqual({
        method: 'POST',
        path: '/api-keys',
        body: { name: 'Anna', level: 'read' },
      });
      expect(within(done).getByTitle('Belépő QR-kód')).toBeTruthy();
      expect(
        (within(done).getByLabelText('Belépő link') as HTMLInputElement).value,
      ).toBe(`${window.location.origin}/app/#key=wzs_newsecret`);

      await userEvent.click(within(done).getByRole('button', { name: 'Kész' }));
      expect(screen.queryByText(/wzs_newsecret/)).toBeNull();
    });

    it('warns before revoking the key in use', async () => {
      const api = start('/settings/keys');
      expect(await screen.findByText('Ez az eszköz')).toBeTruthy();
      await userEvent.click(
        screen.getByRole('button', { name: 'Gábor visszavonása' }),
      );
      expect(screen.getByRole('dialog').textContent).toContain(
        'ez az eszköz is kijelentkezik',
      );
      await userEvent.click(screen.getByRole('button', { name: 'Mégse' }));

      await userEvent.click(
        screen.getByRole('button', { name: 'Telefon visszavonása' }),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'Visszavonás' }),
      );
      await waitFor(() =>
        expect(api.changes).toEqual([
          { method: 'DELETE', path: '/api-keys/2' },
        ]),
      );
      expect(await screen.findByText('Visszavont kulcsok (1)')).toBeTruthy();
    });
  });

  it('shows the command log in words', async () => {
    start('/settings/log');
    expect(
      await screen.findByText('Jelenet: Naplemente · Sebesség 80%'),
    ).toBeTruthy();
    expect(screen.getByText('Az egész lakás')).toBeTruthy();
    expect(screen.getByText('Kikapcsolás')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('shows how the service is', async () => {
    start('/settings/system');
    expect(await screen.findByText('2/2 elérhető')).toBeTruthy();
    expect(screen.getByText('3 nap 4 óra')).toBeTruthy();
    expect(screen.getByText('v24.22.3')).toBeTruthy();
  });
});
