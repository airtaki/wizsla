import request from 'supertest';
import { createTestApp, type TestApp } from './support/app.js';
import { FakeWizBulb } from './support/fake-wiz-bulb.js';

describe('Bulbs (e2e)', () => {
  let t: TestApp;
  let admin: string;
  let fakes: FakeWizBulb[] = [];

  const http = () => request(t.app.getHttpServer());
  const startFake = async (
    options: Parameters<typeof FakeWizBulb.start>[0] = {},
  ) => {
    const fake = await FakeWizBulb.start(options);
    fakes.push(fake);
    return fake;
  };
  const addBulb = (fake: FakeWizBulb, body: object = {}) =>
    http()
      .post('/bulbs')
      .set('X-API-Key', admin)
      .send({ ...fake.address, ...body });
  const createRoom = async (name: string) =>
    (await http().post('/rooms').set('X-API-Key', admin).send({ name })).body;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    await t.reset();
    admin = await t.createKey('admin');
  });

  afterEach(async () => {
    await Promise.all(fakes.map((fake) => fake.stop()));
    fakes = [];
  });

  describe('registering', () => {
    it('reads MAC, model and colour range from the bulb', async () => {
      const fake = await startFake({ mac: 'A8BB50ABCDEF' });
      const res = await addBulb(fake).expect(201);
      expect(res.body).toMatchObject({
        mac: 'a8bb50abcdef',
        name: 'Wiz abcdef',
        slug: 'wiz-abcdef',
        ip: '127.0.0.1',
        port: fake.address.port,
        moduleName: 'ESP01_SHRGB1C_31',
        fwVersion: '1.31.0',
        kind: 'rgb',
        kelvinMin: 2200,
        kelvinMax: 6500,
        enabled: true,
        room: null,
      });
      expect(res.body.lastSeenAt).toEqual(expect.any(String));
    });

    it('takes a name, a slug and a room', async () => {
      const room = await createRoom('Étkező');
      const fake = await startFake();
      const res = await addBulb(fake, {
        name: 'Étkező 1',
        roomId: room.id,
      }).expect(201);
      expect(res.body).toMatchObject({
        name: 'Étkező 1',
        slug: 'etkezo-1',
        room: { id: room.id, name: 'Étkező', slug: 'etkezo' },
      });
    });

    it('works without getModelConfig (older firmware)', async () => {
      const fake = await startFake({ modelConfig: null });
      const res = await addBulb(fake).expect(201);
      expect(res.body).toMatchObject({ kind: 'rgb', kelvinMin: 2200 });
    });

    it('refuses the same bulb twice', async () => {
      const fake = await startFake();
      await addBulb(fake, { name: 'Első' }).expect(201);
      const res = await addBulb(fake, { name: 'Második' }).expect(409);
      expect(res.body.message).toMatch(/already registered as "Első"/);
    });

    it('refuses a duplicate slug', async () => {
      await addBulb(await startFake({ mac: 'a8bb50000001' }), {
        name: 'Lámpa',
      }).expect(201);
      const res = await addBulb(await startFake({ mac: 'a8bb50000002' }), {
        name: 'Lámpa',
      }).expect(409);
      expect(res.body.message).toBe('Already exists: slug');
    });

    it('answers 504 when nothing answers at the address', async () => {
      const fake = await startFake();
      fake.silent = true;
      await addBulb(fake).expect(504);
      expect(await t.prisma.bulb.count()).toBe(0);
    });

    it('refuses a room that does not exist', async () => {
      const fake = await startFake();
      const res = await addBulb(fake, { roomId: 999 }).expect(400);
      expect(res.body.message).toBe('Room #999 does not exist');
    });

    it.each([
      [{ ip: 'lampa' }],
      [{ ip: '127.0.0.1', port: 70000 }],
      [{ ip: '127.0.0.1', slug: 'Rossz Slug' }],
      [{ ip: '127.0.0.1', mac: 'a8bb50000001' }],
    ])('rejects the invalid body %j with 400', async (body) => {
      await http()
        .post('/bulbs')
        .set('X-API-Key', admin)
        .send(body)
        .expect(400);
    });
  });

  describe('managing', () => {
    it('lists bulbs, filtered by room', async () => {
      const nappali = await createRoom('Nappali');
      await addBulb(await startFake({ mac: 'a8bb50000001' }), {
        name: 'Nappali 10',
        roomId: nappali.id,
      });
      await addBulb(await startFake({ mac: 'a8bb50000002' }), {
        name: 'Nappali 2',
        roomId: nappali.id,
      });
      await addBulb(await startFake({ mac: 'a8bb50000003' }), {
        name: 'Gazdátlan',
      });
      const read = await t.createKey('read');
      const names = async (query: string) =>
        (
          await http().get(`/bulbs${query}`).set('X-API-Key', read).expect(200)
        ).body.map((b: { name: string }) => b.name);

      expect(await names('')).toEqual(['Gazdátlan', 'Nappali 2', 'Nappali 10']);
      expect(await names('?room=nappali')).toEqual(['Nappali 2', 'Nappali 10']);
      expect(await names(`?room=${nappali.id}`)).toHaveLength(2);
      expect(await names('?room=none')).toEqual(['Gazdátlan']);
      await http().get('/bulbs?room=pince').set('X-API-Key', read).expect(404);
    });

    it('renames a bulb and moves it between rooms', async () => {
      const konyha = await createRoom('Konyha');
      const { body } = await addBulb(await startFake());
      const patch = (data: object) =>
        http().patch(`/bulbs/${body.slug}`).set('X-API-Key', admin).send(data);

      const moved = await patch({ name: 'Pult', roomId: konyha.id }).expect(
        200,
      );
      expect(moved.body).toMatchObject({
        name: 'Pult',
        slug: 'wiz-000001',
        room: { slug: 'konyha' },
      });

      const unassigned = await patch({ roomId: null }).expect(200);
      expect(unassigned.body.room).toBeNull();

      await patch({ roomId: 999 }).expect(400);
      await patch({ enabled: false }).expect(200);
      expect((await t.prisma.bulb.findFirstOrThrow()).enabled).toBe(false);
    });

    it('takes a new address only if the same bulb answers there', async () => {
      const original = await startFake({ mac: 'a8bb50000001' });
      const { body } = await addBulb(original).expect(201);
      const patchPort = (port: number) =>
        http()
          .patch(`/bulbs/${body.id}`)
          .set('X-API-Key', admin)
          .send({ port });

      const other = await startFake({ mac: 'a8bb50000002' });
      const res = await patchPort(other.address.port).expect(409);
      expect(res.body.message).toMatch(/different bulb \(a8bb50000002\)/);

      const same = await startFake({ mac: 'a8bb50000001' });
      const ok = await patchPort(same.address.port).expect(200);
      expect(ok.body.port).toBe(same.address.port);
    });

    it('deletes a bulb', async () => {
      const { body } = await addBulb(await startFake());
      await http()
        .delete(`/bulbs/${body.id}`)
        .set('X-API-Key', admin)
        .expect(204);
      await http().get(`/bulbs/${body.id}`).set('X-API-Key', admin).expect(404);
    });

    it('lets only admin keys change bulbs', async () => {
      const { body } = await addBulb(await startFake());
      const control = await t.createKey('control');
      await http()
        .patch(`/bulbs/${body.id}`)
        .set('X-API-Key', control)
        .send({ name: 'X' })
        .expect(403);
      await http()
        .delete(`/bulbs/${body.id}`)
        .set('X-API-Key', control)
        .expect(403);
    });
  });

  describe('identify', () => {
    const setPilotStates = (fake: FakeWizBulb) =>
      fake.received
        .filter((m) => m.method === 'setPilot')
        .map((m) => m.params.state);

    it('blinks three times and leaves a switched-off bulb off', async () => {
      const fake = await startFake({ state: { state: false } });
      const { body } = await addBulb(fake);
      const control = await t.createKey('control');

      await http()
        .post(`/bulbs/${body.slug}/identify`)
        .set('X-API-Key', control)
        .expect(204);
      expect(setPilotStates(fake)).toEqual([
        true,
        false,
        true,
        false,
        true,
        false,
      ]);
      expect(fake.state.state).toBe(false);
    });

    it('leaves a lit bulb on', async () => {
      const fake = await startFake({ state: { state: true } });
      const { body } = await addBulb(fake);
      await http()
        .post(`/bulbs/${body.id}/identify`)
        .set('X-API-Key', admin)
        .expect(204);
      expect(setPilotStates(fake)[0]).toBe(false);
      expect(fake.state.state).toBe(true);
    });

    it('is not allowed with a read key', async () => {
      const { body } = await addBulb(await startFake());
      const read = await t.createKey('read');
      await http()
        .post(`/bulbs/${body.id}/identify`)
        .set('X-API-Key', read)
        .expect(403);
    });

    it('answers 504 when the bulb is unreachable', async () => {
      const fake = await startFake();
      const { body } = await addBulb(fake);
      fake.silent = true;
      await http()
        .post(`/bulbs/${body.id}/identify`)
        .set('X-API-Key', admin)
        .expect(504);
    });
  });
});
