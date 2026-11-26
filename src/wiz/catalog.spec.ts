import { bulbKindFromModule, capabilitiesFromModule } from './capabilities.js';
import { findScene, SCENES, scenesForKind } from './scenes.js';

describe('bulbKindFromModule', () => {
  it.each([
    ['ESP01_SHRGB1C_31', 'rgb'],
    ['ESP03_SHRGBP_31', 'rgb'],
    ['ESP56_SHTW3_01', 'tunable-white'],
    ['ESP06_SHDW9_01', 'dimmable-white'],
    ['ESP10_SOCKET_06', 'socket'],
    ['ESP99_SOMETHING_01', 'unknown'],
    ['', 'unknown'],
  ])('%s → %s', (moduleName, kind) => {
    expect(bulbKindFromModule(moduleName)).toBe(kind);
  });

  it('gives RGB bulbs colour, white temperature and scenes', () => {
    expect(capabilitiesFromModule('ESP01_SHRGB1C_31')).toEqual({
      kind: 'rgb',
      dimming: true,
      colorTemp: { min: 2200, max: 6500 },
      color: true,
      scenes: true,
    });
  });

  it('gives dimmable-white bulbs no colour temperature', () => {
    expect(capabilitiesFromModule('ESP06_SHDW9_01').colorTemp).toBeNull();
  });

  it('takes the exact Kelvin range from the model config', () => {
    expect(
      capabilitiesFromModule('ESP56_SHTW3_01', {
        cctRange: [2000, 2700, 6500, 6800],
      }).colorTemp,
    ).toEqual({ min: 2000, max: 6800 });
  });

  it('ignores a Kelvin range on bulbs without white temperature', () => {
    expect(
      capabilitiesFromModule('ESP06_SHDW9_01', {
        cctRange: [2200, 2700, 6500, 6500],
      }).colorTemp,
    ).toBeNull();
  });
});

describe('scenes', () => {
  it('has unique ids and slugs', () => {
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length);
    expect(new Set(SCENES.map((s) => s.slug)).size).toBe(SCENES.length);
  });

  it.each([
    [3, 'Sunset'],
    ['sunset', 'Sunset'],
    ['Snowy Sky', 'Snowy Sky'],
    ['snowy-sky', 'Snowy Sky'],
    [' TV time ', 'TV Time'],
    ['wake-up', 'Wake-up'],
  ])('finds %j', (ref, name) => {
    expect(findScene(ref)?.name).toBe(name);
  });

  it.each([[0], [34], [1000], ['moonlight']])('does not know %j', (ref) => {
    expect(findScene(ref)).toBeUndefined();
  });

  it('offers only white scenes to dimmable-white bulbs', () => {
    const names = scenesForKind('dimmable-white').map((s) => s.name);

    expect(names).toContain('Snowy Sky');
    expect(names).not.toContain('Sunset');
  });
});
