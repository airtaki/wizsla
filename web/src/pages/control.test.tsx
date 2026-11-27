import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeApi } from '../test/fake-api';
import { bulb, fakeLights, lit, overview, room } from '../test/fixtures';
import { renderApp } from '../test/render';

function home() {
  return overview(
    [
      room('Nappali', [
        bulb('Állólámpa', lit({ brightness: 40 })),
        bulb('Olvasó'),
      ]),
      room('Háló', [bulb('Éjjeli', { online: false })]),
    ],
    [bulb('Erkély')],
  );
}

function start(path: string, key = 'wzs_phone', options = {}) {
  const api = fakeLights(home(), options);
  fakeApi(api.handlers);
  renderApp(path, key);
  return api;
}

describe('Controlling lights', () => {
  beforeEach(() => localStorage.clear());

  it('lists the rooms with what is lit, and the bulbs without a room', async () => {
    start('/');
    const nappali = await screen.findByRole('link', { name: /Nappali/ });
    expect(nappali.textContent).toContain('1/2 ég');
    expect(screen.getByRole('link', { name: /Háló/ }).textContent).toContain(
      'Nem elérhető',
    );
    expect(screen.getByText('1 izzó ég · 3/4 elérhető')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Szoba nélkül' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Háló felkapcsolása' }),
    ).toHaveProperty('disabled', true);
  });

  it('switches a room off at once, then sends the command', async () => {
    const api = start('/');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Nappali lekapcsolása' }),
    );
    expect(
      screen.getByRole('button', { name: 'Nappali felkapcsolása' }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(api.commands).toEqual([
        { path: '/rooms/nappali/state', body: { on: false } },
      ]),
    );
  });

  it('switches everything off', async () => {
    const api = start('/');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Minden ki' }),
    );
    await waitFor(() =>
      expect(api.commands).toEqual([{ path: '/state', body: { on: false } }]),
    );
    expect(
      await screen.findByText(/Minden lámpa le van kapcsolva/),
    ).toBeTruthy();
  });

  it('tells when a bulb of the room did not answer', async () => {
    start('/rooms/halo');
    // The only bulb is offline, so the room cannot be switched.
    expect(
      await screen.findByRole('button', { name: 'Háló felkapcsolása' }),
    ).toHaveProperty('disabled', true);
  });

  it('sets a room scene and shows it as playing', async () => {
    const api = start('/rooms/nappali');
    await userEvent.click(await screen.findByRole('tab', { name: 'Jelenet' }));
    await userEvent.click(screen.getByRole('button', { name: 'Naplemente' }));
    await waitFor(() =>
      expect(api.commands).toEqual([
        { path: '/rooms/nappali/state', body: { scene: 3 } },
      ]),
    );
    expect(
      screen
        .getByRole('button', { name: 'Naplemente' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    // Sunset's speed can be set.
    expect(screen.getByRole('slider', { name: 'Sebesség' })).toBeTruthy();
  });

  it('sends a colour and a white temperature', async () => {
    const api = start('/rooms/nappali');
    await userEvent.click(await screen.findByRole('tab', { name: 'Színes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Szín #ff3b30' }));
    await waitFor(() => expect(api.commands).toHaveLength(1));
    await userEvent.click(screen.getByRole('tab', { name: 'Fehér' }));
    await userEvent.click(screen.getByRole('button', { name: /Hideg/ }));
    await waitFor(() =>
      expect(api.commands.map((c) => c.body)).toEqual([
        { color: '#ff3b30' },
        { colorTemp: 6500 },
      ]),
    );
  });

  it('sends only the latest slider position while a command is on its way', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const api = start('/rooms/nappali', 'wzs_phone', { hold: () => gate });

    const slider = await screen.findByRole('slider', { name: 'Fényerő' });
    expect(slider.getAttribute('aria-valuenow')).toBe('40');
    slider.focus();
    await userEvent.keyboard('{ArrowRight>5/}');

    expect(slider.getAttribute('aria-valuenow')).toBe('45');
    await waitFor(() => expect(api.commands).toHaveLength(1));
    release();
    await waitFor(() =>
      expect(api.commands.map((c) => c.body)).toEqual([
        { brightness: 41 },
        { brightness: 45 },
      ]),
    );
  });

  it('shows an error when a single bulb does not answer', async () => {
    const api = fakeLights(overview([room('Háló', [bulb('Éjjeli', lit())])]));
    fakeApi(api.handlers);
    renderApp('/bulbs/ejjeli', 'wzs_phone');
    const power = await screen.findByRole('button', {
      name: 'Éjjeli kikapcsolása',
    });
    // The bulb drops out after the page has loaded.
    api.state.rooms[0].bulbs[0].online = false;
    await userEvent.click(power);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Az izzó nem válaszolt.',
    );
  });

  it('applies a scene to the chosen target', async () => {
    const api = start('/scenes');
    await userEvent.selectOptions(
      await screen.findByRole('combobox'),
      'room:nappali',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Meleg fehér' }));
    await waitFor(() =>
      expect(api.commands).toEqual([
        { path: '/rooms/nappali/state', body: { scene: 11 } },
      ]),
    );
  });

  it('only shows a read key what is going on', async () => {
    start('/rooms/nappali', 'wzs_read');
    const power = await screen.findByRole('button', {
      name: 'Nappali lekapcsolása',
    });
    expect(power).toHaveProperty('disabled', true);
    expect(
      screen
        .getByRole('slider', { name: 'Fényerő' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
    const list = screen.getByRole('heading', { name: 'Izzók' }).parentElement!;
    for (const button of within(list).getAllByRole('button')) {
      expect(button).toHaveProperty('disabled', true);
    }
  });
});
