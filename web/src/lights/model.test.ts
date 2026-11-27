import { describe, expect, it } from 'vitest';
import { bulb, lit, overview, room, SCENES } from '../test/fixtures';
import {
  applyCommand,
  applyToOverview,
  bulbsOf,
  groupState,
  mergeCommands,
} from './model';

describe('applyCommand', () => {
  const white = {
    on: true,
    mode: 'white' as const,
    brightness: 50,
    colorTemp: 2700,
  };

  it('switches off and keeps the rest', () => {
    expect(applyCommand(white, { on: false })).toEqual({ ...white, on: false });
  });

  it('switches on with any other command', () => {
    expect(
      applyCommand({ ...white, on: false }, { brightness: 80 }),
    ).toMatchObject({
      on: true,
      brightness: 80,
    });
  });

  it('keeps brightness within 10–100 for a delta', () => {
    expect(applyCommand(white, { brightnessDelta: -90 }).brightness).toBe(10);
  });

  it('goes to colour mode for a colour, dropping the Kelvin', () => {
    const next = applyCommand(white, { color: '#ff8000' });
    expect(next).toMatchObject({
      mode: 'color',
      color: { r: 255, g: 128, b: 0 },
    });
    expect(next.colorTemp).toBeUndefined();
  });

  it('plays a scene by id, with its name', () => {
    expect(applyCommand(white, { scene: 3 }, SCENES)).toMatchObject({
      mode: 'scene',
      scene: { id: 3, name: 'Sunset', slug: 'sunset' },
    });
  });

  it('goes back to white for a colour temperature', () => {
    const color = applyCommand(white, { color: '#00ff00' });
    expect(applyCommand(color, { colorTemp: 4000 })).toMatchObject({
      mode: 'white',
      colorTemp: 4000,
      color: undefined,
    });
  });
});

describe('mergeCommands', () => {
  it('keeps the brightness and takes the newer light', () => {
    expect(
      mergeCommands({ brightness: 40, colorTemp: 3000 }, { scene: 3 }),
    ).toEqual({
      brightness: 40,
      scene: 3,
    });
  });

  it('lets a switch-off replace everything', () => {
    expect(mergeCommands({ brightness: 40 }, { on: false })).toEqual({
      on: false,
    });
    expect(mergeCommands({ on: false }, { brightness: 40 })).toEqual({
      brightness: 40,
    });
  });

  it('keeps a speed for the scene, and drops it with the scene', () => {
    expect(mergeCommands({ scene: 4 }, { speed: 80 })).toEqual({
      scene: 4,
      speed: 80,
    });
    expect(mergeCommands({ speed: 80 }, { scene: 11 })).toEqual({ scene: 11 });
    expect(mergeCommands({ speed: 80 }, { colorTemp: 2700 })).toEqual({
      colorTemp: 2700,
    });
  });

  it('takes the later brightness', () => {
    expect(mergeCommands({ brightnessDelta: 10 }, { brightness: 30 })).toEqual({
      brightness: 30,
    });
  });
});

describe('groupState', () => {
  it('averages the lit bulbs and finds their common mode', () => {
    const group = groupState([
      bulb('A', lit({ brightness: 40 })),
      bulb('B', lit({ brightness: 60 })),
      bulb('C'),
    ]);
    expect(group).toMatchObject({
      reachable: 3,
      lit: 2,
      brightness: 50,
      mode: 'white',
      colorTemp: 2700,
    });
  });

  it('reports mixed modes and no common scene', () => {
    const group = groupState([
      bulb('A', lit()),
      bulb(
        'B',
        lit({
          mode: 'scene',
          scene: { id: 3, name: 'Sunset', slug: 'sunset' },
        }),
      ),
    ]);
    expect(group.mode).toBe('mixed');
    expect(group.sceneId).toBeNull();
  });

  it('offers the white range every bulb can do, and colour if one can', () => {
    const group = groupState([
      bulb('A'),
      bulb('B', { kind: 'tunable-white', kelvin: { min: 2700, max: 6500 } }),
      bulb('C', { kind: 'dimmable-white', kelvin: null }),
    ]);
    expect(group.kelvin).toEqual({ min: 2700, max: 6500 });
    expect(group.canColor).toBe(true);
  });

  it('ignores offline and disabled bulbs', () => {
    const group = groupState([
      bulb('A', { online: false, ...lit() }),
      bulb('B', { enabled: false }),
    ]);
    expect(group).toMatchObject({ reachable: 0, lit: 0, mode: null });
  });
});

describe('applyToOverview', () => {
  const nappali = room('Nappali', [
    bulb('Állólámpa', lit()),
    bulb('Polc', { online: false }),
  ]);
  const konyha = room('Konyha', [bulb('Pult', lit())]);
  const before = overview(
    [nappali, konyha],
    [bulb('Erkély', { enabled: false })],
  );

  it('changes only the reachable bulbs of the target, and the summaries', () => {
    const after = applyToOverview(
      before,
      { kind: 'room', ref: 'nappali' },
      { on: false },
    );
    expect(after.rooms[0].bulbs.map((b) => b.state?.on)).toEqual([
      false,
      false,
    ]);
    expect(after.rooms[0].bulbs[1]).toBe(before.rooms[0].bulbs[1]);
    expect(after.rooms[1].bulbs[0].state?.on).toBe(true);
    expect(after.rooms[0].summary.on).toBe(0);
    expect(after.summary.on).toBe(1);
  });

  it('addresses enabled bulbs only for the whole home', () => {
    expect(bulbsOf(before, { kind: 'all' }).map((b) => b.name)).toEqual([
      'Állólámpa',
      'Polc',
      'Pult',
    ]);
  });
});
