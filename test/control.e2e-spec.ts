import request from 'supertest';
import { slugify } from '../src/common/slug.js';
import { createTestApp, type TestApp } from './support/app.js';
import { FakeWizBulb } from './support/fake-wiz-bulb.js';

describe('Control (e2e)', () => {
  let t: TestApp;
  let control: string;
  let fakes: FakeWizBulb[] = [];
  let nextMac = 1;

  const http = () => request(t.app.getHttpServer());
  const patch = (path: string, body: object, key = control) =>
    http().patch(path).set('X-API-Key', key).send(body);

  async function addBulb(
    name: string,
    options: {
      state?: Record<string, unknown>;
      roomId?: number;
      kind?: string;
      enabled?: boolean;
    } = {},
  ) {
    const mac = `a8bb5000${String(nextMac++).padStart(4, '0')}`;
    const fake = await FakeWizBulb.start({ mac, state: options.state });
    fakes.push(fake);
    const white = options.kind === 'dimmable-white';
    const bulb = await t.prisma.bulb.create({
      data: {
        mac,
        name,
        slug: slugify(name),
        ...fake.address,
        kind: options.kind ?? 'rgb',
        kelvinMin: white ? null : 2200,
        kelvinMax: white ? null : 6500,
        roomId: options.roomId,
        enabled: options.enabled ?? true,
      },
    });
    return { fake, bulb };
  }

  const sent = (fake: FakeWizBulb) =>
    fake.received.filter((m) => m.method === 'setPilot').map((m) => m.params);

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    await t.reset();
    control = await t.createKey('control', 'Telefon');
  });

  afterEach(async () => {
    await Promise.all(fakes.map((fake) => fake.stop()));
    fakes = [];
  });

  describe('one bulb', () => {
    it('switches on at a brightness and colour temperature', async () => {
      const { fake } = await addBulb('Olvasó');
      const res = await patch('/bulbs/olvaso/state', {
        brightness: 30,
        colorTemp: 2700,
      }).expect(200);

      expect(sent(fake)).toEqual([{ state: true, dimming: 30, temp: 2700 }]);
      expect(res.body).toMatchObject({
        status: 'ok',
        bulb: {
          name: 'Olvasó',
          online: true,
          state: { on: true, brightness: 30, mode: 'white', colorTemp: 2700 },
        },
      });
    });

    it('switches off', async () => {
      const { fake } = await addBulb('Lámpa', { state: { state: true } });
      const res = await patch('/bulbs/lampa/state', { on: false }).expect(200);
      expect(sent(fake)).toEqual([{ state: false }]);
      expect(res.body.bulb.state.on).toBe(false);
    });

    it('sets a colour and a scene', async () => {
      const { fake } = await addBulb('Lámpa');
      await patch('/bulbs/lampa/state', { color: '#FF8800' }).expect(200);
      const scene = await patch('/bulbs/lampa/state', {
        scene: 'sunset',
        speed: 120,
      }).expect(200);

      expect(sent(fake)).toEqual([
        { state: true, r: 255, g: 136, b: 0 },
        { state: true, sceneId: 3, speed: 120 },
      ]);
      expect(scene.body.bulb.state).toMatchObject({
        mode: 'scene',
        scene: { name: 'Sunset' },
        speed: 120,
      });
    });

    it('makes the light a bit warmer and dimmer', async () => {
      const { fake } = await addBulb('Lámpa', {
        state: { state: true, dimming: 50, temp: 3000 },
      });
      const res = await patch('/bulbs/lampa/state', {
        colorTempDelta: -300,
        brightnessDelta: -10,
      }).expect(200);
      expect(sent(fake)).toEqual([{ state: true, dimming: 40, temp: 2700 }]);
      expect(res.body.bulb.state).toMatchObject({
        brightness: 40,
        colorTemp: 2700,
      });
    });

    it('answers 400 when the bulb cannot do it', async () => {
      const { fake } = await addBulb('Fehér', { kind: 'dimmable-white' });
      const res = await patch('/bulbs/feher/state', {
        color: '#ff0000',
      }).expect(400);
      expect(res.body.message).toBe('This bulb cannot show colours');
      expect(sent(fake)).toEqual([]);
    });

    it('answers 504 when the bulb does not answer', async () => {
      const { fake } = await addBulb('Lámpa');
      fake.silent = true;
      await patch('/bulbs/lampa/state', { on: true }).expect(504);

      const read = await t.createKey('read');
      const state = await http()
        .get('/bulbs/lampa/state')
        .set('X-API-Key', read)
        .expect(200);
      expect(state.body.online).toBe(false);
    });

    it('refuses a disabled bulb', async () => {
      await addBulb('Lámpa', { enabled: false });
      await patch('/bulbs/lampa/state', { on: true }).expect(409);
    });

    it.each([
      [{}],
      [{ on: false, brightness: 30 }],
      [{ color: '#ff0000', scene: 'ocean' }],
      [{ brightness: 5 }],
      [{ brightness: 101 }],
      [{ brightnessDelta: 0 }],
      [{ color: 'red' }],
      [{ scene: 'disco' }],
      [{ scene: true }],
      [{ temp: 2700 }],
    ])('rejects the command %j with 400', async (body) => {
      const { fake } = await addBulb('Lámpa');
      await patch('/bulbs/lampa/state', body).expect(400);
      expect(sent(fake)).toEqual([]);
    });

    it('needs a control key', async () => {
      await addBulb('Lámpa');
      const read = await t.createKey('read');
      await patch('/bulbs/lampa/state', { on: true }, read).expect(403);
    });
  });

  describe('a room and the whole home', () => {
    it('controls every enabled bulb of a room and reports each', async () => {
      const room = await t.prisma.room.create({
        data: { name: 'Étkező', slug: 'etkezo' },
      });
      const a = await addBulb('Étkező 1', { roomId: room.id });
      const b = await addBulb('Étkező 2', { roomId: room.id });
      const dead = await addBulb('Étkező 3', { roomId: room.id });
      dead.fake.silent = true;
      const white = await addBulb('Étkező 4', {
        roomId: room.id,
        kind: 'dimmable-white',
      });
      const off = await addBulb('Étkező 5', {
        roomId: room.id,
        enabled: false,
      });
      const elsewhere = await addBulb('Konyha 1');

      const res = await patch('/rooms/etkezo/state', {
        color: '#00ff00',
      }).expect(200);

      expect(res.body.summary).toEqual({
        bulbs: 4,
        ok: 2,
        offline: 1,
        unsupported: 1,
        failed: 0,
      });
      expect(
        res.body.results.map(
          (r: { bulb: { name: string }; status: string }) => [
            r.bulb.name,
            r.status,
          ],
        ),
      ).toEqual([
        ['Étkező 1', 'ok'],
        ['Étkező 2', 'ok'],
        ['Étkező 3', 'offline'],
        ['Étkező 4', 'unsupported'],
      ]);
      expect(sent(a.fake)).toEqual([{ state: true, r: 0, g: 255, b: 0 }]);
      expect(sent(b.fake)).toHaveLength(1);
      expect(sent(white.fake)).toEqual([]);
      expect(sent(off.fake)).toEqual([]);
      expect(sent(elsewhere.fake)).toEqual([]);
    });

    it('applies a delta to each bulb from its own state', async () => {
      const room = await t.prisma.room.create({
        data: { name: 'Nappali', slug: 'nappali' },
      });
      const a = await addBulb('Nappali 1', {
        roomId: room.id,
        state: { state: true, temp: 3000 },
      });
      const b = await addBulb('Nappali 2', {
        roomId: room.id,
        state: { state: true, temp: 2300 },
      });

      await patch('/rooms/nappali/state', { colorTempDelta: -300 }).expect(200);
      expect(sent(a.fake)).toEqual([{ state: true, temp: 2700 }]);
      expect(sent(b.fake)).toEqual([{ state: true, temp: 2200 }]);
    });

    it('switches everything off', async () => {
      const room = await t.prisma.room.create({
        data: { name: 'Háló', slug: 'halo' },
      });
      const a = await addBulb('Éjjeli', { roomId: room.id });
      const b = await addBulb('Új');

      const res = await patch('/state', { on: false }).expect(200);
      expect(res.body.summary).toMatchObject({ bulbs: 2, ok: 2 });
      expect(sent(a.fake)).toEqual([{ state: false }]);
      expect(sent(b.fake)).toEqual([{ state: false }]);
    });

    it('answers 404 for an unknown room', async () => {
      await patch('/rooms/pince/state', { on: true }).expect(404);
    });
  });

  describe('scenes and the command log', () => {
    it('lists the scenes', async () => {
      const read = await t.createKey('read');
      const res = await http()
        .get('/scenes')
        .set('X-API-Key', read)
        .expect(200);
      expect(res.body).toContainEqual({
        id: 11,
        name: 'Warm White',
        slug: 'warm-white',
        supportedKinds: ['rgb', 'tunable-white'],
        speedAdjustable: false,
        dimmable: true,
      });
    });

    it('logs who sent what, for admins only', async () => {
      await addBulb('Lámpa');
      await patch('/bulbs/lampa/state', { brightness: 40 }).expect(200);
      await patch('/state', { on: false }).expect(200);

      const admin = await t.createKey('admin');
      await http().get('/commands').set('X-API-Key', control).expect(403);
      const res = await http()
        .get('/commands?limit=10')
        .set('X-API-Key', admin)
        .expect(200);

      expect(res.body).toMatchObject([
        {
          keyName: 'Telefon',
          target: 'all',
          targetId: null,
          targetName: 'all bulbs',
          command: { on: false },
          bulbs: 1,
          succeeded: 1,
        },
        {
          keyName: 'Telefon',
          target: 'bulb',
          targetName: 'Lámpa',
          command: { brightness: 40 },
          bulbs: 1,
          succeeded: 1,
        },
      ]);
      expect(res.body[0].durationMs).toEqual(expect.any(Number));
      expect(res.body[0]).not.toHaveProperty('apiKeyId');
    });

    it('logs failed commands too', async () => {
      const { fake } = await addBulb('Lámpa');
      fake.silent = true;
      await patch('/bulbs/lampa/state', { on: true }).expect(504);
      const rows = await t.prisma.commandLog.findMany();
      expect(rows).toMatchObject([{ bulbs: 1, succeeded: 0 }]);
    });
  });
});
