import request from 'supertest';
import { createTestApp, type TestApp } from './support/app.js';

describe('Rooms (e2e)', () => {
  let t: TestApp;
  let admin: string;

  const http = () => request(t.app.getHttpServer());
  const createRoom = (body: object) =>
    http().post('/rooms').set('X-API-Key', admin).send(body);

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

  it('creates a room with a slug derived from the name', async () => {
    const res = await createRoom({ name: '  Étkező ' }).expect(201);
    expect(res.body).toMatchObject({
      name: 'Étkező',
      slug: 'etkezo',
      sortOrder: 0,
      bulbs: [],
    });
  });

  it('finds a room by id and by slug', async () => {
    const { body } = await createRoom({ name: 'Nappali' }).expect(201);
    const key = await t.createKey('read');

    for (const ref of [String(body.id), 'nappali', 'NAPPALI']) {
      const res = await http()
        .get(`/rooms/${ref}`)
        .set('X-API-Key', key)
        .expect(200);
      expect(res.body.id).toBe(body.id);
    }
    await http().get('/rooms/konyha').set('X-API-Key', key).expect(404);
    await http().get('/rooms/999').set('X-API-Key', key).expect(404);
  });

  it('lists rooms by sort order, then name', async () => {
    await createRoom({ name: 'Háló', sortOrder: 4 });
    await createRoom({ name: 'Konyha', sortOrder: 3 });
    await createRoom({ name: 'Étkező', sortOrder: 3 });
    const res = await http().get('/rooms').set('X-API-Key', admin).expect(200);
    expect(res.body.map((r: { slug: string }) => r.slug)).toEqual([
      'etkezo',
      'konyha',
      'halo',
    ]);
  });

  it('refuses a duplicate slug with 409', async () => {
    await createRoom({ name: 'Nappali' }).expect(201);
    const res = await createRoom({ name: 'Nappali' }).expect(409);
    expect(res.body.message).toBe('Already exists: slug');
  });

  it.each([
    [{ name: 'Nappali', slug: 'Nappali' }],
    [{ name: 'Nappali', slug: '123' }],
    [{ name: '' }],
    [{ name: 'Nappali', sortOrder: -1 }],
    [{ name: 'Nappali', color: 'red' }],
  ])('rejects the invalid body %j with 400', async (body) => {
    await createRoom(body).expect(400);
  });

  it('asks for a slug when the name gives none', async () => {
    const res = await createRoom({ name: '42' }).expect(400);
    expect(res.body.message).toMatch(/give one explicitly/);
    await createRoom({ name: '42', slug: 'szoba-42' }).expect(201);
  });

  it('keeps the slug when renaming, unless a new one is given', async () => {
    const { body } = await createRoom({ name: 'Ebédlő' });
    const renamed = await http()
      .patch('/rooms/ebedlo')
      .set('X-API-Key', admin)
      .send({ name: 'Étkező' })
      .expect(200);
    expect(renamed.body).toMatchObject({ name: 'Étkező', slug: 'ebedlo' });

    const reslugged = await http()
      .patch(`/rooms/${body.id}`)
      .set('X-API-Key', admin)
      .send({ slug: 'etkezo' })
      .expect(200);
    expect(reslugged.body.slug).toBe('etkezo');
  });

  it('lets only admin keys change rooms', async () => {
    for (const level of ['read', 'control'] as const) {
      const key = await t.createKey(level);
      await http().get('/rooms').set('X-API-Key', key).expect(200);
      await http()
        .post('/rooms')
        .set('X-API-Key', key)
        .send({ name: 'Nappali' })
        .expect(403);
    }
  });

  it('keeps the bulbs of a deleted room, without a room', async () => {
    const { body: room } = await createRoom({ name: 'Konyha' });
    const bulb = await t.prisma.bulb.create({
      data: {
        mac: 'a8bb50000001',
        ip: '192.168.10.2',
        name: 'Konyha 1',
        slug: 'konyha-1',
        moduleName: 'ESP01_SHRGB1C_31',
        kind: 'rgb',
        roomId: room.id,
      },
    });

    const withBulb = await http()
      .get('/rooms/konyha')
      .set('X-API-Key', admin)
      .expect(200);
    expect(withBulb.body.bulbs).toEqual([
      { id: bulb.id, name: 'Konyha 1', slug: 'konyha-1' },
    ]);

    await http().delete('/rooms/konyha').set('X-API-Key', admin).expect(204);
    await http().get('/rooms/konyha').set('X-API-Key', admin).expect(404);
    const kept = await t.prisma.bulb.findUniqueOrThrow({
      where: { id: bulb.id },
    });
    expect(kept.roomId).toBeNull();
  });
});
