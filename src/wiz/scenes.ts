import type { BulbKind } from './capabilities.js';

/** A built-in Wiz scene (dynamic or static light preset). */
export interface SceneDefinition {
  id: number;
  name: string;
  /** URL- and API-friendly name, e.g. `snowy-sky`. */
  slug: string;
  /** Bulb kinds that can play the scene. */
  supportedKinds: readonly BulbKind[];
  /** Whether `speed` can be set together with the scene. */
  speedAdjustable: boolean;
  /** Whether `dimming` can be set together with the scene. */
  dimmable: boolean;
}

const RGB: readonly BulbKind[] = ['rgb'];
const RGB_TW: readonly BulbKind[] = ['rgb', 'tunable-white'];
const ALL_WHITE: readonly BulbKind[] = [
  'rgb',
  'tunable-white',
  'dimmable-white',
];

const SPEED = true;
const DIM = true;

function scene(
  id: number,
  name: string,
  supportedKinds: readonly BulbKind[],
  speedAdjustable: boolean,
  dimmable: boolean,
): SceneDefinition {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return { id, name, slug, supportedKinds, speedAdjustable, dimmable };
}

/**
 * Scene ids are fixed by the Wiz firmware. Id 34 is left out: its purpose is
 * unknown and it is not offered in the Wiz app; id 1000 (Rhythm) needs the
 * app's music sync and cannot be used over the local API.
 */
export const SCENES: readonly SceneDefinition[] = [
  scene(1, 'Ocean', RGB, SPEED, DIM),
  scene(2, 'Romance', RGB, SPEED, DIM),
  scene(3, 'Sunset', RGB, SPEED, DIM),
  scene(4, 'Party', RGB, SPEED, DIM),
  scene(5, 'Fireplace', RGB, SPEED, DIM),
  scene(6, 'Cozy', RGB_TW, SPEED, DIM),
  scene(7, 'Forest', RGB, SPEED, DIM),
  scene(8, 'Pastel Colors', RGB, SPEED, DIM),
  scene(9, 'Wake-up', ALL_WHITE, !SPEED, DIM),
  scene(10, 'Bedtime', ALL_WHITE, !SPEED, DIM),
  scene(11, 'Warm White', RGB_TW, !SPEED, DIM),
  scene(12, 'Daylight', RGB_TW, !SPEED, DIM),
  scene(13, 'Cool White', ALL_WHITE, !SPEED, DIM),
  scene(14, 'Night Light', ALL_WHITE, !SPEED, !DIM),
  scene(15, 'Focus', RGB_TW, !SPEED, DIM),
  scene(16, 'Relax', RGB_TW, !SPEED, DIM),
  scene(17, 'True Colors', RGB, !SPEED, DIM),
  scene(18, 'TV Time', RGB_TW, !SPEED, DIM),
  scene(19, 'Plant Growth', RGB, !SPEED, DIM),
  scene(20, 'Spring', RGB, SPEED, DIM),
  scene(21, 'Summer', RGB, SPEED, DIM),
  scene(22, 'Fall', RGB, SPEED, DIM),
  scene(23, 'Deep Dive', RGB, SPEED, DIM),
  scene(24, 'Jungle', RGB, SPEED, DIM),
  scene(25, 'Mojito', RGB, SPEED, DIM),
  scene(26, 'Club', RGB, SPEED, DIM),
  scene(27, 'Christmas', RGB, SPEED, DIM),
  scene(28, 'Halloween', RGB, SPEED, DIM),
  scene(29, 'Candlelight', ALL_WHITE, SPEED, DIM),
  scene(30, 'Golden White', ALL_WHITE, SPEED, DIM),
  scene(31, 'Pulse', ALL_WHITE, SPEED, DIM),
  scene(32, 'Steampunk', ALL_WHITE, SPEED, DIM),
  scene(33, 'Diwali', ALL_WHITE, SPEED, DIM),
  scene(35, 'Alarm', RGB, !SPEED, !DIM),
  scene(36, 'Snowy Sky', ALL_WHITE, SPEED, DIM),
];

const byId = new Map(SCENES.map((s) => [s.id, s]));
const bySlug = new Map(SCENES.map((s) => [s.slug, s]));

/** Finds a scene by id, slug (`snowy-sky`) or name (`Snowy Sky`). */
export function findScene(ref: number | string): SceneDefinition | undefined {
  if (typeof ref === 'number') return byId.get(ref);
  const slug = ref
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return bySlug.get(slug);
}

export function scenesForKind(kind: BulbKind): SceneDefinition[] {
  return SCENES.filter((s) => s.supportedKinds.includes(kind));
}
