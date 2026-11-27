import request from 'supertest';
import { slugify } from '../src/common/slug.js';
import { createTestApp, type TestApp } from './support/app.js';
import { FakeWizBulb } from './support/fake-wiz-bulb.js';

describe('State (e2e)', () => {
  let t: TestApp;
  let read: string;
  let fakes: FakeWizBulb[] = [];
  let nextMac = 1;

  const http = () => request(t.app.getHttpServer());
  const get = (path: string) =>
    http().get(path).set('X-API-Key', read).expect(200);

  /** A simulated bulb, registered in the database (optionally in a room). */
  async function addBulb(
    name: string,
    state: Record<string, unknown>,
    roomId?: number,
  ) {
    const mac = `a8bb5000${String(nextMac++).padStart(4, '0')}`;
    const fake = await FakeWizBulb.start({ mac, state });
    fakes.push(fake);
    const bulb = await t.prisma.bulb.create({
      data: {
        mac,
        name,
        slug: slugify(name),
        ...fake.address,
        kind: 'rgb',
        roomId,
      },
    });
    return { fake, bulb };
  }

  const pilotCalls = (fake: FakeWizBulb) =>
    fake.received.filter((m) => m.method === 'getPilot').length;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    await t.reset();
    read = await t.createKey('read');
  });

  afterEach(async () => {
    await Promise.all(fakes.map((fake) => fake.stop()));
    fakes = [];
  });

  it('reports a bulb in white mode', async () => {
    await addBulb('Olvasó', {
      state: true,
      dimming: 40,
      temp: 2700,
    });

    const res = await get('/bulbs/olvaso/state');
    expect(res.body).toMatchObject({
      name: 'Olvasó',
      kind: 'rgb',
      // No model range stored: the typical range of colour bulbs.
      kelvin: { min: 2200, max: 6500 },
      enabled: true,
      online: true,
      room: null,
      state: {
        on: true,
        mode: 'white',
        brightness: 40,
        colorTemp: 2700,
        rssi: -55,
      },
    });
    expect(res.body.stateAt).toBe(res.body.checkedAt);
    expect(res.body).not.toHaveProperty('error');
  });

  it('reports colour and scene modes', async () => {
    await addBulb('Színes', {
      state: true,
      r: 255,
      g: 0,
      b: 64,
      temp: undefined,
    });
    await addBulb('Buli', {
      state: true,
      sceneId: 4,
      speed: 150,
      temp: undefined,
    });

    const color = await get('/bulbs/szines/state');
    expect(color.body.state).toMatchObject({
      mode: 'color',
      color: { r: 255, g: 0, b: 64 },
    });

    const scene = await get('/bulbs/buli/state');
    expect(scene.body.state).toMatchObject({
      mode: 'scene',
      scene: { id: 4, name: 'Party', slug: 'party' },
      speed: 150,
    });
  });

  it('answers from memory until asked to refresh', async () => {
    const { fake } = await addBulb('Lámpa', { state: false });

    await get('/bulbs/lampa/state');
    expect(pilotCalls(fake)).toBe(1);

    // Switched on from the Wiz app: the cached answer does not know yet.
    fake.state.state = true;
    const cached = await get('/bulbs/lampa/state');
    expect(cached.body.state.on).toBe(false);
    expect(pilotCalls(fake)).toBe(1);

    const fresh = await get('/bulbs/lampa/state?refresh=true');
    expect(fresh.body.state.on).toBe(true);
    expect(pilotCalls(fake)).toBe(2);
  });

  it('keeps the last state of a bulb that went offline', async () => {
    const { fake } = await addBulb('Lámpa', { state: true, dimming: 70 });
    await get('/bulbs/lampa/state');

    fake.silent = true;
    const res = await get('/bulbs/lampa/state?refresh=true');
    expect(res.body).toMatchObject({
      online: false,
      state: { on: true, brightness: 70 },
      error: expect.stringMatching(/no answer|timed out|unreachable/i),
    });
    expect(Date.parse(res.body.checkedAt)).toBeGreaterThan(
      Date.parse(res.body.stateAt),
    );

    fake.silent = false;
    const back = await get('/bulbs/lampa/state?refresh=true');
    expect(back.body.online).toBe(true);
    expect(back.body).not.toHaveProperty('error');
  });

  it('notices when another bulb answers at the address', async () => {
    const { bulb } = await addBulb('Lámpa', { state: true });
    await t.prisma.bulb.update({
      where: { id: bulb.id },
      data: { mac: 'a8bb50ffffff' },
    });

    const res = await get('/bulbs/lampa/state');
    expect(res.body.online).toBe(false);
    expect(res.body.error).toMatch(/different bulb \(a8bb5000/);
  });

  it('does not ask disabled bulbs', async () => {
    const { fake, bulb } = await addBulb('Lámpa', { state: true });
    await t.prisma.bulb.update({
      where: { id: bulb.id },
      data: { enabled: false },
    });

    const res = await get('/bulbs/lampa/state?refresh=true');
    expect(res.body).toMatchObject({
      enabled: false,
      online: null,
      state: null,
    });
    expect(pilotCalls(fake)).toBe(0);
  });

  it('summarizes a room', async () => {
    const room = await t.prisma.room.create({
      data: { name: 'Étkező', slug: 'etkezo' },
    });
    await addBulb(
      'Étkező 1',
      { state: true, dimming: 40, temp: 2700 },
      room.id,
    );
    await addBulb(
      'Étkező 2',
      { state: true, dimming: 60, temp: 3100 },
      room.id,
    );
    await addBulb('Étkező 3', { state: false }, room.id);
    const { fake: dead } = await addBulb('Étkező 10', { state: true }, room.id);
    dead.silent = true;
    await addBulb('Máshol', { state: true });

    const res = await get(`/rooms/etkezo/state`);
    expect(res.body).toMatchObject({
      id: room.id,
      name: 'Étkező',
      slug: 'etkezo',
      summary: {
        total: 4,
        online: 3,
        on: 2,
        brightness: 50,
        colorTemp: 2900,
      },
    });
    expect(res.body.bulbs.map((b: { name: string }) => b.name)).toEqual([
      'Étkező 1',
      'Étkező 2',
      'Étkező 3',
      'Étkező 10',
    ]);

    await http().get('/rooms/pince/state').set('X-API-Key', read).expect(404);
  });

  it('gives an overview of every room and the unassigned bulbs', async () => {
    const halo = await t.prisma.room.create({
      data: { name: 'Háló', slug: 'halo', sortOrder: 2 },
    });
    await t.prisma.room.create({
      data: { name: 'Konyha', slug: 'konyha', sortOrder: 1 },
    });
    await addBulb('Éjjeli', { state: true, dimming: 20 }, halo.id);
    await addBulb('Új', { state: false });

    const res = await get('/state');
    expect(res.body.summary).toMatchObject({ total: 2, online: 2, on: 1 });
    expect(res.body.rooms).toMatchObject([
      { slug: 'konyha', summary: { total: 0 }, bulbs: [] },
      {
        slug: 'halo',
        summary: { total: 1, on: 1 },
        bulbs: [{ name: 'Éjjeli' }],
      },
    ]);
    expect(res.body.unassigned).toMatchObject([{ name: 'Új', online: true }]);
  });

  it('asks each bulb once even when requests overlap', async () => {
    const { fake } = await addBulb('Lámpa', { state: true });
    fake.delayMs = 50;
    await Promise.all([
      get('/bulbs/lampa/state?refresh=true'),
      get('/state?refresh=true'),
      get('/bulbs/lampa/state'),
    ]);
    expect(pilotCalls(fake)).toBe(1);
  });

  it('rejects an invalid refresh value', async () => {
    await http().get('/state?refresh=yes').set('X-API-Key', read).expect(400);
    await http().get('/state?verbose=true').set('X-API-Key', read).expect(400);
  });

  it('needs a key', async () => {
    await http().get('/state').expect(401);
  });
});
