import { BadRequestException } from '@nestjs/common';
import type { BulbState } from '../wiz/protocol.js';
import {
  type BulbTraits,
  needsCurrentState,
  parseCommand,
  planFor,
} from './command.js';
import type { LightCommandDto } from './control.dto.js';

const rgb = { kind: 'rgb', kelvinMin: 2200, kelvinMax: 6500 };
const white = { kind: 'dimmable-white', kelvinMin: null, kelvinMax: null };
const socket = { kind: 'socket', kelvinMin: null, kelvinMax: null };

const plan = (
  dto: LightCommandDto,
  bulb: BulbTraits = rgb,
  current?: Partial<BulbState>,
) =>
  planFor(
    bulb,
    parseCommand(dto),
    current && { mac: 'm', on: true, mode: 'white', ...current },
  );

describe('parseCommand', () => {
  it.each<[LightCommandDto, RegExp]>([
    [{}, /at least one/],
    [{ on: false, brightness: 50 }, /on: false cannot be combined/],
    [{ color: '#ff0000', colorTemp: 2700 }, /Only one of .*color, colorTemp/],
    [{ scene: 'ocean', colorTempDelta: -100 }, /Only one of/],
    [{ brightness: 50, brightnessDelta: 10 }, /not both/],
    [{ warmWhite: 100 }, /need color/],
    [{ scene: 'disco' }, /Unknown scene "disco"/],
    [{ scene: 'Warm White', speed: 50 }, /no adjustable speed/],
    [{ scene: 'night-light', brightness: 50 }, /cannot be dimmed/],
    [{ colorTemp: 2700, speed: 50 }, /speed is for scenes/],
  ])('rejects %j', (dto, message) => {
    expect(() => parseCommand(dto)).toThrow(BadRequestException);
    expect(() => parseCommand(dto)).toThrow(message);
  });

  it('resolves scenes by id, slug and name', () => {
    expect(parseCommand({ scene: 3 }).scene?.name).toBe('Sunset');
    expect(parseCommand({ scene: 'sunset' }).scene?.id).toBe(3);
    expect(parseCommand({ scene: 'Warm White' }).scene?.id).toBe(11);
  });

  it('reads #RRGGBB in either case', () => {
    expect(parseCommand({ color: '#Ff8800' }).color).toEqual({
      r: 255,
      g: 136,
      b: 0,
    });
  });

  it('knows when the current state is needed', () => {
    expect(needsCurrentState(parseCommand({ brightness: 50 }))).toBe(false);
    expect(needsCurrentState(parseCommand({ brightnessDelta: 5 }))).toBe(true);
    expect(needsCurrentState(parseCommand({ colorTempDelta: 5 }))).toBe(true);
    expect(needsCurrentState(parseCommand({ speed: 50 }))).toBe(true);
    expect(needsCurrentState(parseCommand({ scene: 'party', speed: 50 }))).toBe(
      false,
    );
  });
});

describe('planFor', () => {
  it('switches off with nothing else', () => {
    expect(plan({ on: false })).toEqual({ params: { state: false } });
  });

  it('switches on whenever something is set', () => {
    expect(plan({ brightness: 30 })).toEqual({
      params: { state: true, dimming: 30 },
    });
    expect(plan({ on: true })).toEqual({ params: { state: true } });
  });

  it('sets a colour with white channels', () => {
    expect(plan({ color: '#ff8800', warmWhite: 40 })).toEqual({
      params: { state: true, r: 255, g: 136, b: 0, w: 40 },
    });
  });

  it('sets a scene with speed and brightness', () => {
    expect(plan({ scene: 'party', speed: 150, brightness: 60 })).toEqual({
      params: { state: true, sceneId: 4, speed: 150, dimming: 60 },
    });
  });

  it("checks colour temperature against the bulb's range", () => {
    expect(plan({ colorTemp: 2700 })).toEqual({
      params: { state: true, temp: 2700 },
    });
    expect(plan({ colorTemp: 2000 })).toEqual({
      unsupported: "2000 K is outside this bulb's range (2200–6500 K)",
    });
  });

  it('adds deltas to the current state, within limits', () => {
    expect(plan({ brightnessDelta: -10 }, rgb, { brightness: 40 })).toEqual({
      params: { state: true, dimming: 30 },
    });
    expect(plan({ brightnessDelta: -50 }, rgb, { brightness: 40 })).toEqual({
      params: { state: true, dimming: 10 },
    });
    expect(plan({ brightnessDelta: 30 }, rgb, { brightness: 90 })).toEqual({
      params: { state: true, dimming: 100 },
    });
    expect(plan({ colorTempDelta: -300 }, rgb, { colorTemp: 2700 })).toEqual({
      params: { state: true, temp: 2400 },
    });
    expect(plan({ colorTempDelta: -1000 }, rgb, { colorTemp: 2700 })).toEqual({
      params: { state: true, temp: 2200 },
    });
  });

  it('takes a colour temperature delta from a static white scene', () => {
    expect(
      plan({ colorTempDelta: -300 }, rgb, {
        mode: 'scene',
        sceneId: 11,
        colorTemp: 2700,
      }),
    ).toEqual({ params: { state: true, temp: 2400 } });
  });

  it('needs a reported colour temperature for a delta', () => {
    expect(
      plan({ colorTempDelta: -300 }, rgb, { mode: 'scene', sceneId: 3 }),
    ).toEqual({
      unsupported:
        'The bulb does not report a colour temperature (scene "Sunset"); set colorTemp instead',
    });
    expect(
      plan({ colorTempDelta: -300 }, rgb, {
        mode: 'color',
        color: { r: 1, g: 2, b: 3 },
      }),
    ).toEqual({
      unsupported:
        'The bulb does not report a colour temperature (color mode); set colorTemp instead',
    });
  });

  it('will not dim a scene that cannot be dimmed', () => {
    expect(
      plan({ brightnessDelta: 10 }, rgb, { mode: 'scene', sceneId: 14 }),
    ).toEqual({ unsupported: 'The scene "Night Light" cannot be dimmed' });
  });

  describe('a speed without a scene', () => {
    const party = { mode: 'scene' as const, sceneId: 4 };

    it('goes alone to a lit bulb, so it stays in its scene', () => {
      expect(plan({ speed: 80 }, rgb, party)).toEqual({
        params: { speed: 80 },
      });
    });

    it('restarts the scene when the bulb is off or more is set', () => {
      expect(plan({ speed: 80 }, rgb, { ...party, on: false })).toEqual({
        params: { state: true, sceneId: 4, speed: 80 },
      });
      expect(plan({ speed: 80, brightness: 60 }, rgb, party)).toEqual({
        params: { state: true, dimming: 60, sceneId: 4, speed: 80 },
      });
    });

    it('needs a scene with a speed', () => {
      expect(plan({ speed: 80 }, rgb, { colorTemp: 3000 })).toEqual({
        unsupported: 'No scene is playing',
      });
      expect(plan({ speed: 80 }, rgb, { mode: 'scene', sceneId: 11 })).toEqual({
        unsupported: 'The scene "Warm White" has no adjustable speed',
      });
      expect(plan({ speed: 80 }, socket, party)).toEqual({
        unsupported: 'This bulb has no scenes',
      });
    });
  });

  it('respects what the bulb can do', () => {
    expect(plan({ color: '#ff0000' }, white)).toEqual({
      unsupported: 'This bulb cannot show colours',
    });
    expect(plan({ colorTemp: 3000 }, white)).toEqual({
      unsupported: 'This bulb has no adjustable white',
    });
    expect(plan({ scene: 'ocean' }, white)).toEqual({
      unsupported: 'This bulb cannot play the scene "Ocean"',
    });
    expect(plan({ scene: 'bedtime' }, white)).toEqual({
      params: { state: true, sceneId: 10 },
    });
    expect(plan({ brightness: 50 }, socket)).toEqual({
      unsupported: 'This bulb cannot be dimmed',
    });
    expect(plan({ on: true }, socket)).toEqual({ params: { state: true } });
  });
});
