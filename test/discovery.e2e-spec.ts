import request from 'supertest';
import { createTestApp, type TestApp } from './support/app.js';
import { FakeWizBulb } from './support/fake-wiz-bulb.js';

// The e2e config points discovery at 127.0.0.1:WIZ_PORT, where one simulated
// bulb listens. (Loopback has no real broadcast, so one bulb per scan.)
const wizPort = Number(process.env.WIZ_PORT);

describe('Discovery (e2e)', () => {
  let t: TestApp;
  let admin: string;
  let fake: FakeWizBulb | undefined;

  const http = () => request(t.app.getHttpServer());
  const scan = () =>
    http().post('/discovery/scan').set('X-API-Key', admin).expect(200);

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
    await fake?.stop();
    fake = undefined;
  });

  it('registers a new bulb without a room, then recognises it', async () => {
    fake = await FakeWizBulb.start({ mac: 'a8bb50c0ffee', port: wizPort });

    const first = await scan();
    expect(first.body).toMatchObject({
      bulbs: [
        {
          status: 'new',
          bulb: {
            mac: 'a8bb50c0ffee',
            name: 'Wiz c0ffee',
            slug: 'wiz-c0ffee',
            ip: '127.0.0.1',
            port: wizPort,
            kind: 'rgb',
            room: null,
          },
        },
      ],
      failed: [],
      missing: [],
    });
    expect(
      fake.received.filter((m) => m.method === 'registration').length,
    ).toBeGreaterThan(0);

    const second = await scan();
    expect(second.body.bulbs).toMatchObject([{ status: 'known' }]);
    expect(await t.prisma.bulb.count()).toBe(1);
  });

  it('keeps name and room, and follows a bulb to its new IP', async () => {
    fake = await FakeWizBulb.start({ mac: 'a8bb50000001', port: wizPort });
    const room = await t.prisma.room.create({
      data: { name: 'Háló', slug: 'halo' },
    });
    await t.prisma.bulb.create({
      data: {
        mac: 'a8bb50000001',
        name: 'Éjjeli',
        slug: 'ejjeli',
        ip: '192.168.10.50',
        port: wizPort,
        roomId: room.id,
      },
    });

    const res = await scan();
    expect(res.body.bulbs).toMatchObject([
      {
        status: 'moved',
        previousIp: '192.168.10.50',
        bulb: {
          name: 'Éjjeli',
          ip: '127.0.0.1',
          moduleName: 'ESP01_SHRGB1C_31',
          kind: 'rgb',
          room: { slug: 'halo' },
        },
      },
    ]);
  });

  it('lists registered bulbs that did not answer as missing', async () => {
    await t.prisma.bulb.create({
      data: {
        mac: 'a8bb50000009',
        name: 'Kikapcsolt',
        slug: 'kikapcsolt',
        ip: '192.168.10.60',
      },
    });

    const res = await scan();
    expect(res.body.bulbs).toEqual([]);
    expect(res.body.missing).toMatchObject([{ name: 'Kikapcsolt' }]);
  });

  it('reports a bulb that answers the broadcast but nothing else', async () => {
    fake = await FakeWizBulb.start({ mac: 'a8bb50000001', port: wizPort });
    fake.rawReply = JSON.stringify({
      method: 'registration',
      env: 'pro',
      result: { mac: 'a8bb50000001', success: true },
    });

    const res = await scan();
    expect(res.body.bulbs).toEqual([]);
    expect(res.body.failed).toMatchObject([
      { ip: '127.0.0.1', mac: 'a8bb50000001' },
    ]);
    expect(await t.prisma.bulb.count()).toBe(0);
  });

  it('needs an admin key', async () => {
    const control = await t.createKey('control');
    await http().post('/discovery/scan').set('X-API-Key', control).expect(403);
  });
});
