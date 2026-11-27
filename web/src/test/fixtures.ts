import {
  applyToOverview,
  bulbsOf,
  type BulbState,
  isReachable,
  type LightCommand,
  type Overview,
  type RoomState,
  type Scene,
  summarize,
  type Target,
} from '../lights/model';
import { type Handler, json, keys } from './fake-api';

export const KEYS = {
  wzs_admin: { name: 'Gábor', level: 'admin' as const },
  wzs_phone: { name: 'Telefon', level: 'control' as const },
  wzs_read: { name: 'Kijelző', level: 'read' as const },
};

export const SCENES: Scene[] = [
  {
    id: 3,
    name: 'Sunset',
    slug: 'sunset',
    supportedKinds: ['rgb'],
    speedAdjustable: true,
    dimmable: true,
  },
  {
    id: 11,
    name: 'Warm White',
    slug: 'warm-white',
    supportedKinds: ['rgb', 'tunable-white'],
    speedAdjustable: false,
    dimmable: true,
  },
  {
    id: 14,
    name: 'Night Light',
    slug: 'night-light',
    supportedKinds: ['rgb', 'tunable-white', 'dimmable-white'],
    speedAdjustable: false,
    dimmable: false,
  },
];

let nextId = 1;

export function bulb(
  name: string,
  overrides: Partial<BulbState> = {},
): BulbState {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
  return {
    id: nextId++,
    name,
    slug,
    kind: 'rgb',
    kelvin: { min: 2200, max: 6500 },
    room: null,
    enabled: true,
    online: true,
    state: { on: false, mode: 'white', brightness: 50, colorTemp: 2700 },
    stateAt: '2026-11-27T08:00:00.000Z',
    checkedAt: '2026-11-27T08:00:00.000Z',
    ...overrides,
  };
}

export const lit = (overrides: Partial<BulbState['state']> = {}) => ({
  state: {
    on: true,
    mode: 'white' as const,
    brightness: 60,
    colorTemp: 2700,
    ...overrides,
  },
});

export function room(name: string, bulbs: BulbState[]): RoomState {
  const slug = bulb(name).slug;
  const id = nextId++;
  const placed = bulbs.map((b) => ({ ...b, room: { id, name, slug } }));
  return { id, name, slug, summary: summarize(placed), bulbs: placed };
}

export function overview(
  rooms: RoomState[],
  unassigned: BulbState[] = [],
): Overview {
  return {
    rooms,
    unassigned,
    summary: summarize([...rooms.flatMap((r) => r.bulbs), ...unassigned]),
  };
}

/**
 * The API over `initial`: commands change the state the way the bulbs
 * would, offline bulbs answer `offline` (504 for a single bulb). `hold`
 * delays every command answer until it resolves.
 */
export function fakeLights(
  initial: Overview,
  options: { hold?: () => Promise<void> } = {},
) {
  let current = initial;
  const commands: { path: string; body: LightCommand }[] = [];

  const command =
    (kindOf: (path: string) => Target): Handler =>
    async (request) => {
      const path = new URL(request.url).pathname;
      const body = (await request.json()) as LightCommand;
      commands.push({ path, body });
      await options.hold?.();

      const target = kindOf(path);
      const bulbs = bulbsOf(current, target);
      if (target.kind === 'bulb' && bulbs[0] && !isReachable(bulbs[0])) {
        return json({ message: 'The bulb did not answer' }, 504);
      }
      current = applyToOverview(current, target, body, SCENES);
      const after = bulbsOf(current, target);
      const results = after.map((b) => ({
        status: isReachable(b) ? ('ok' as const) : ('offline' as const),
        bulb: b,
      }));
      if (target.kind === 'bulb') return json(results[0]);
      const count = (s: string) => results.filter((r) => r.status === s).length;
      return json({
        summary: {
          bulbs: results.length,
          ok: count('ok'),
          offline: count('offline'),
          unsupported: 0,
          failed: 0,
        },
        results,
      });
    };

  const ref = (path: string) => decodeURIComponent(path.split('/')[2]);

  return {
    handlers: {
      'GET /api-keys/me': keys(KEYS),
      'GET /state': () => json(current),
      'GET /scenes': () => json(SCENES),
      'PATCH /state': command(() => ({ kind: 'all' })),
      'PATCH /rooms/:ref/state': command((p) => ({
        kind: 'room',
        ref: ref(p),
      })),
      'PATCH /bulbs/:ref/state': command((p) => ({
        kind: 'bulb',
        ref: ref(p),
      })),
    } satisfies Record<string, Handler>,
    commands,
    get state() {
      return current;
    },
  };
}
