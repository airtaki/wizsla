import type {
  ApiKey,
  Bulb,
  CommandLogEntry,
  DiscoveryResult,
  Health,
  Room,
} from '../admin/queries';
import { type Handler, json, keys } from './fake-api';
import { KEYS, overview, SCENES } from './fixtures';

const AT = '2026-11-27T08:00:00.000Z';

export function adminBulb(
  id: number,
  name: string,
  overrides: Partial<Bulb> = {},
): Bulb {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    mac: `a8bb500000${String(id).padStart(2, '0')}`,
    ip: `192.168.10.${100 + id}`,
    port: 38899,
    enabled: true,
    room: null,
    kind: 'rgb',
    kelvinMin: 2200,
    kelvinMax: 6500,
    moduleName: 'ESP25_SHRGB_01',
    fwVersion: '1.31.0',
    lastSeenAt: AT,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

export interface Call {
  method: string;
  path: string;
  body?: unknown;
}

/**
 * The admin API over a small home: rooms Nappali and Háló, a bulb in
 * Nappali and one without a room, and two keys (the first is the one
 * `wzs_admin` signs in with). Changes are kept and recorded in `calls`.
 */
export function fakeAdmin() {
  let rooms: Omit<Room, 'bulbs'>[] = [
    {
      id: 1,
      name: 'Nappali',
      slug: 'nappali',
      sortOrder: 1,
      createdAt: AT,
      updatedAt: AT,
    },
    {
      id: 2,
      name: 'Háló',
      slug: 'halo',
      sortOrder: 2,
      createdAt: AT,
      updatedAt: AT,
    },
  ];
  let bulbs: Bulb[] = [
    adminBulb(1, 'Állólámpa', {
      slug: 'allolampa',
      room: { id: 1, name: 'Nappali', slug: 'nappali' },
    }),
    adminBulb(2, 'Wiz 0002', { slug: 'wiz-0002' }),
  ];
  let apiKeys: ApiKey[] = [
    {
      id: 1,
      name: 'Gábor',
      level: 'admin',
      prefix: 'wzs_abc',
      createdAt: AT,
      lastUsedAt: AT,
      revokedAt: null,
    },
    {
      id: 2,
      name: 'Telefon',
      level: 'control',
      prefix: 'wzs_def',
      createdAt: AT,
      lastUsedAt: null,
      revokedAt: null,
    },
  ];
  const log: CommandLogEntry[] = [
    {
      id: 2,
      createdAt: AT,
      keyName: 'Telefon',
      target: 'room',
      targetId: 1,
      targetName: 'Nappali',
      command: { scene: 3, speed: 80 },
      bulbs: 2,
      succeeded: 1,
      durationMs: 120,
    },
    {
      id: 1,
      createdAt: AT,
      keyName: 'Gábor',
      target: 'all',
      targetId: null,
      targetName: 'all bulbs',
      command: { on: false },
      bulbs: 2,
      succeeded: 2,
      durationMs: 90,
    },
  ];
  const health: Health = {
    status: 'ok',
    version: '2.0.0',
    node: 'v24.22.3',
    uptime: 3 * 86_400 + 4 * 3600,
    database: 'ok',
    bulbs: { total: 2, online: 2 },
    lastBackup: AT,
  };
  const calls: Call[] = [];

  const withBulbs = (room: Omit<Room, 'bulbs'>): Room => ({
    ...room,
    bulbs: bulbs
      .filter((b) => b.room?.id === room.id)
      .map(({ id, name, slug }) => ({ id, name, slug })),
  });
  const ref = (request: Request) =>
    decodeURIComponent(new URL(request.url).pathname.split('/')[2]);
  const matches = (item: { id: number; slug: string }, r: string) =>
    String(item.id) === r || item.slug === r;
  const record = async (request: Request) => {
    const path = new URL(request.url).pathname;
    const text = await request.text();
    const call = {
      method: request.method,
      path,
      body: text ? JSON.parse(text) : undefined,
    };
    calls.push(call);
    return call.body as Record<string, unknown>;
  };

  const handlers: Record<string, Handler> = {
    'GET /api-keys/me': keys(KEYS),
    'GET /scenes': () => json(SCENES),
    'GET /state': () => json(overview([])),
    'GET /rooms': () =>
      json([...rooms].sort((a, b) => a.sortOrder - b.sortOrder).map(withBulbs)),
    'POST /rooms': async (request) => {
      const body = await record(request);
      const name = String(body.name);
      const room = {
        id: rooms.length + 10,
        name,
        slug: (body.slug as string) ?? name.toLowerCase(),
        sortOrder: (body.sortOrder as number) ?? 0,
        createdAt: AT,
        updatedAt: AT,
      };
      rooms.push(room);
      return json(withBulbs(room), 201);
    },
    'PATCH /rooms/:ref': async (request) => {
      const r = ref(request);
      const body = await record(request);
      rooms = rooms.map((room) =>
        matches(room, r) ? { ...room, ...body } : room,
      );
      return json(withBulbs(rooms.find((room) => matches(room, r))!));
    },
    'DELETE /rooms/:ref': async (request) => {
      const r = ref(request);
      await record(request);
      rooms = rooms.filter((room) => !matches(room, r));
      return new Response(null, { status: 204 });
    },
    'GET /bulbs': () => json(bulbs),
    'PATCH /bulbs/:ref': async (request) => {
      const r = ref(request);
      const { roomId, ...body } = await record(request);
      bulbs = bulbs.map((bulb) => {
        if (!matches(bulb, r)) return bulb;
        const room =
          roomId === undefined
            ? bulb.room
            : roomId === null
              ? null
              : (({ id, name, slug }) => ({ id, name, slug }))(
                  rooms.find((x) => x.id === roomId)!,
                );
        return { ...bulb, ...body, room };
      });
      return json(bulbs.find((bulb) => matches(bulb, r)));
    },
    'DELETE /bulbs/:ref': async (request) => {
      const r = ref(request);
      await record(request);
      bulbs = bulbs.filter((bulb) => !matches(bulb, r));
      return new Response(null, { status: 204 });
    },
    'POST /bulbs/:ref/identify': async (request) => {
      await record(request);
      return new Response(null, { status: 204 });
    },
    'POST /discovery/scan': async (request) => {
      await record(request);
      const fresh = adminBulb(3, 'Wiz 0003', { slug: 'wiz-0003' });
      bulbs.push(fresh);
      const result: DiscoveryResult = {
        bulbs: [
          { status: 'new', bulb: fresh },
          { status: 'known', bulb: bulbs[0] },
        ],
        failed: [],
        missing: [bulbs[1]],
      };
      return json(result);
    },
    'GET /api-keys': () => json(apiKeys),
    'POST /api-keys': async (request) => {
      const body = await record(request);
      const created: ApiKey = {
        id: apiKeys.length + 1,
        name: String(body.name),
        level: body.level as ApiKey['level'],
        prefix: 'wzs_new',
        createdAt: AT,
        lastUsedAt: null,
        revokedAt: null,
      };
      apiKeys.push(created);
      return json({ apiKey: created, key: 'wzs_newsecret' }, 201);
    },
    'DELETE /api-keys/:id': async (request) => {
      const id = Number(ref(request));
      await record(request);
      apiKeys = apiKeys.map((k) => (k.id === id ? { ...k, revokedAt: AT } : k));
      return new Response(null, { status: 204 });
    },
    'GET /commands': () => json(log),
    'GET /health': () => json(health),
  };

  return {
    handlers,
    calls,
    /** The calls that changed something. */
    get changes() {
      return calls.filter((c) => c.method !== 'GET');
    },
  };
}
