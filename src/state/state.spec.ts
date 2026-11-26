import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type { BulbStateDto, LightStateDto } from './state.dto.js';
import { StatePoller } from './state.poller.js';
import { summarize, toLightState, type StateService } from './state.service.js';

const bulb = (
  online: boolean | null,
  state: Partial<LightStateDto> | null,
): BulbStateDto => ({
  id: 1,
  name: 'x',
  slug: 'x',
  room: null,
  enabled: true,
  online,
  state: state && { on: false, mode: 'white', ...state },
  stateAt: null,
  checkedAt: null,
});

describe('summarize', () => {
  it('counts online and lit bulbs, averaging only the lit ones', () => {
    expect(
      summarize([
        bulb(true, { on: true, brightness: 40, colorTemp: 2700 }),
        bulb(true, { on: true, brightness: 61, colorTemp: 3000 }),
        bulb(true, { on: true, brightness: 100, mode: 'scene' }),
        bulb(true, {
          on: true,
          brightness: 100,
          mode: 'scene',
          colorTemp: 2700,
        }),
        bulb(true, { on: false, brightness: 10, colorTemp: 6500 }),
        bulb(false, { on: true, brightness: 100, colorTemp: 6500 }),
        bulb(null, null),
      ]),
    ).toEqual({
      total: 7,
      online: 5,
      on: 4,
      brightness: 75,
      colorTemp: 2800,
    });
  });

  it('gives null averages when nothing is lit', () => {
    expect(summarize([bulb(true, { on: false })])).toMatchObject({
      on: 0,
      brightness: null,
      colorTemp: null,
    });
  });
});

describe('toLightState', () => {
  it('names the scene', () => {
    expect(
      toLightState({
        mac: 'm',
        on: true,
        mode: 'scene',
        sceneId: 4,
        speed: 100,
      }).scene,
    ).toEqual({ id: 4, name: 'Party', slug: 'party' });
  });

  it('leaves out an unknown scene', () => {
    expect(
      toLightState({ mac: 'm', on: true, mode: 'scene', sceneId: 999 }).scene,
    ).toBeUndefined();
  });
});

describe('StatePoller', () => {
  const config = (ms: number) =>
    ({ get: () => ms }) as unknown as ConfigService<Env, true>;

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('polls at once, then after each finished round', async () => {
    const refreshAll = vi.fn().mockResolvedValue(undefined);
    const poller = new StatePoller(
      { refreshAll } as unknown as StateService,
      config(20000),
    );

    poller.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshAll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(19999);
    expect(refreshAll).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refreshAll).toHaveBeenCalledTimes(2);

    poller.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(60000);
    expect(refreshAll).toHaveBeenCalledTimes(2);
  });

  it('keeps polling after a failed round', async () => {
    const refreshAll = vi
      .fn()
      .mockRejectedValueOnce(new Error('database is locked'))
      .mockResolvedValue(undefined);
    const poller = new StatePoller(
      { refreshAll } as unknown as StateService,
      config(5000),
    );
    // The failure is logged; keep the test output clean.
    vi.spyOn(
      (poller as unknown as { logger: { error: () => void } }).logger,
      'error',
    ).mockImplementation(() => undefined);

    poller.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(5000);
    expect(refreshAll).toHaveBeenCalledTimes(2);
    poller.onModuleDestroy();
  });

  it('does nothing when turned off', async () => {
    const refreshAll = vi.fn();
    const poller = new StatePoller(
      { refreshAll } as unknown as StateService,
      config(0),
    );
    vi.spyOn(
      (poller as unknown as { logger: { log: () => void } }).logger,
      'log',
    ).mockImplementation(() => undefined);
    poller.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(60000);
    expect(refreshAll).not.toHaveBeenCalled();
  });
});
