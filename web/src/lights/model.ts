import type { Schemas } from '../api/client';

export type Overview = Schemas['StateOverviewDto'];
export type RoomState = Schemas['RoomStateDto'];
export type BulbState = Schemas['BulbStateDto'];
export type LightState = Schemas['LightStateDto'];
export type Summary = Schemas['StateSummaryDto'];
export type LightCommand = Schemas['LightCommandDto'];
export type CommandResult = Schemas['BulbCommandResultDto'];
export type Scene = Schemas['SceneDto'];
export type KelvinRange = Schemas['KelvinRangeDto'];

/** What a command is sent to. `ref` is a slug. */
export type Target =
  | { kind: 'all' }
  | { kind: 'room'; ref: string }
  | { kind: 'bulb'; ref: string };

export const BRIGHTNESS_MIN = 10;
export const BRIGHTNESS_MAX = 100;

/** Enabled and answered the last check: commands can reach it. */
export function isReachable(bulb: BulbState): boolean {
  return bulb.enabled && bulb.online === true;
}

export function isLit(bulb: BulbState): boolean {
  return isReachable(bulb) && bulb.state?.on === true;
}

export function allBulbs(overview: Overview): BulbState[] {
  return [...overview.rooms.flatMap((r) => r.bulbs), ...overview.unassigned];
}

/** The bulbs a command to `target` reaches, as the API picks them. */
export function bulbsOf(overview: Overview, target: Target): BulbState[] {
  switch (target.kind) {
    case 'all':
      return allBulbs(overview).filter((b) => b.enabled);
    case 'room':
      return (
        overview.rooms.find((r) => r.slug === target.ref)?.bulbs ?? []
      ).filter((b) => b.enabled);
    case 'bulb':
      return allBulbs(overview).filter((b) => b.slug === target.ref);
  }
}

/** Same rules as the API's summary (src/state/state.service.ts). */
export function summarize(bulbs: BulbState[]): Summary {
  const online = bulbs.filter((b) => b.online);
  const lit = online.filter((b) => b.state?.on);
  return {
    total: bulbs.length,
    online: online.length,
    on: lit.length,
    brightness: average(lit.map((b) => b.state?.brightness)),
    colorTemp: average(lit.map((b) => b.state?.colorTemp)),
  };
}

function average(values: (number | undefined)[]): number | null {
  const numbers = values.filter((v): v is number => v !== undefined);
  if (numbers.length === 0) return null;
  return Math.round(numbers.reduce((sum, v) => sum + v, 0) / numbers.length);
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * What a bulb will show after `command`, as far as it can be told without
 * asking it: any command but `on: false` switches it on.
 */
export function applyCommand(
  light: LightState | null,
  command: LightCommand,
  scenes: Scene[] = [],
): LightState {
  const current: LightState = light ?? { on: false, mode: 'unknown' };
  if (command.on === false) return { ...current, on: false };

  const next: LightState = { ...current, on: true };
  if (command.brightness !== undefined) next.brightness = command.brightness;
  if (command.brightnessDelta !== undefined) {
    next.brightness = clamp(
      (current.brightness ?? BRIGHTNESS_MAX) + command.brightnessDelta,
      BRIGHTNESS_MIN,
      BRIGHTNESS_MAX,
    );
  }
  if (command.colorTemp !== undefined) {
    Object.assign(next, whiteOf(command.colorTemp));
  }
  if (command.colorTempDelta !== undefined && current.colorTemp !== undefined) {
    Object.assign(next, whiteOf(current.colorTemp + command.colorTempDelta));
  }
  if (command.color !== undefined) {
    next.mode = 'color';
    next.color = hexToRgb(command.color);
    next.coldWhite = command.coldWhite;
    next.warmWhite = command.warmWhite;
    delete next.colorTemp;
    delete next.scene;
  }
  if (command.scene !== undefined) {
    const scene = scenes.find(
      (s) => s.id === command.scene || s.slug === command.scene,
    );
    next.mode = 'scene';
    next.scene = scene && { id: scene.id, name: scene.name, slug: scene.slug };
    delete next.color;
    delete next.colorTemp;
  }
  if (command.speed !== undefined) next.speed = command.speed;
  return next;
}

function whiteOf(colorTemp: number): Partial<LightState> {
  return {
    mode: 'white',
    colorTemp,
    color: undefined,
    scene: undefined,
  };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** The overview after `command`, before the bulbs answer. */
export function applyToOverview(
  overview: Overview,
  target: Target,
  command: LightCommand,
  scenes: Scene[] = [],
): Overview {
  const ids = new Set(
    bulbsOf(overview, target)
      .filter(isReachable)
      .map((b) => b.id),
  );
  return mapBulbs(overview, (bulb) =>
    ids.has(bulb.id)
      ? { ...bulb, state: applyCommand(bulb.state, command, scenes) }
      : bulb,
  );
}

/** The overview with the bulbs the API read back after a command. */
export function mergeResults(
  overview: Overview,
  results: CommandResult[],
): Overview {
  const byId = new Map(results.map((r) => [r.bulb.id, r.bulb]));
  return mapBulbs(overview, (bulb) => byId.get(bulb.id) ?? bulb);
}

function mapBulbs(
  overview: Overview,
  map: (bulb: BulbState) => BulbState,
): Overview {
  const rooms = overview.rooms.map((room) => {
    const bulbs = room.bulbs.map(map);
    return { ...room, bulbs, summary: summarize(bulbs) };
  });
  const unassigned = overview.unassigned.map(map);
  return {
    rooms,
    unassigned,
    summary: summarize([...rooms.flatMap((r) => r.bulbs), ...unassigned]),
  };
}

const EXCLUSIVE: (keyof LightCommand)[] = [
  'color',
  'colorTemp',
  'colorTempDelta',
  'scene',
];

/**
 * One command doing what `first` and then `second` would. Used to fold
 * commands queued while an earlier one is on its way.
 */
export function mergeCommands(
  first: LightCommand,
  second: LightCommand,
): LightCommand {
  if (second.on === false || first.on === false) return second;
  const kept: LightCommand = { ...first };
  // A new mode or scene ends the old one, and the old speed with it.
  if (EXCLUSIVE.some((key) => second[key] !== undefined)) {
    for (const key of [
      ...EXCLUSIVE,
      'coldWhite',
      'warmWhite',
      'speed',
    ] as const) {
      delete kept[key];
    }
  }
  if (second.brightness !== undefined) delete kept.brightnessDelta;
  if (second.brightnessDelta !== undefined) delete kept.brightness;
  return { ...kept, ...second };
}

/** How a group of bulbs looks together, for its controls. */
export interface GroupState {
  reachable: number;
  lit: number;
  /** Average of the lit bulbs, else of the reachable ones. */
  brightness: number | null;
  /** The lit bulbs' common mode, or `mixed`. */
  mode: LightState['mode'] | 'mixed' | null;
  colorTemp: number | null;
  /** The colour all lit bulbs show, as `#rrggbb`. */
  color: string | null;
  /** The scene all lit bulbs play. */
  sceneId: number | null;
  speed: number | null;
  /** The white range every reachable bulb can do. */
  kelvin: KelvinRange | null;
  canColor: boolean;
  kinds: string[];
}

export function groupState(bulbs: BulbState[]): GroupState {
  const reachable = bulbs.filter(isReachable);
  const lit = reachable.filter((b) => b.state?.on);
  const shown = lit.length > 0 ? lit : reachable;
  const lights = shown.flatMap((b) => (b.state ? [b.state] : []));
  const same = <T>(values: T[]): T | null =>
    values.length > 0 && values.every((v) => v === values[0])
      ? values[0]
      : null;

  const ranges = reachable.flatMap((b) => (b.kelvin ? [b.kelvin] : []));
  const kelvin =
    ranges.length > 0
      ? {
          min: Math.max(...ranges.map((r) => r.min)),
          max: Math.min(...ranges.map((r) => r.max)),
        }
      : null;

  return {
    reachable: reachable.length,
    lit: lit.length,
    brightness: average(lights.map((l) => l.brightness)),
    mode:
      lights.length === 0 ? null : (same(lights.map((l) => l.mode)) ?? 'mixed'),
    colorTemp: average(lights.map((l) => l.colorTemp)),
    color: same(lights.map((l) => (l.color ? rgbToHex(l.color) : null))),
    sceneId: same(lights.map((l) => l.scene?.id ?? null)),
    speed: average(lights.map((l) => l.speed)),
    kelvin: kelvin && kelvin.min <= kelvin.max ? kelvin : null,
    canColor: reachable.some((b) => b.kind === 'rgb'),
    kinds: [...new Set(reachable.map((b) => b.kind))],
  };
}
