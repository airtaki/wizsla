import request from 'supertest';
import { createTestApp, type TestApp } from './support/app.js';

describe('API keys and access levels (e2e)', () => {
  let t: TestApp;
  let adminKey: string;

  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    await t.reset();
    adminKey = await t.createKey('admin', 'Admin');
  });

  describe('authentication', () => {
    it('leaves /health public', async () => {
      await http().get('/health').expect(200);
    });

    it('rejects a request without a key', async () => {
      const res = await http().get('/api-keys').expect(401);
      expect(res.body.message).toBe('API key required');
    });

    it.each([['wzs_doesnotexist123'], ['not-a-key'], ['wzs_']])(
      'rejects the unknown key %s',
      async (key) => {
        await http().get('/api-keys').set('X-API-Key', key).expect(401);
      },
    );

    it('accepts the key in X-API-Key', async () => {
      await http().get('/api-keys').set('X-API-Key', adminKey).expect(200);
    });

    it('accepts the key as a Bearer token', async () => {
      await http()
        .get('/api-keys')
        .set('Authorization', `Bearer ${adminKey}`)
        .expect(200);
    });

    it('rejects a revoked key', async () => {
      const key = await t.createKey('control');
      const { id } = await t.prisma.apiKey.findFirstOrThrow({
        where: { level: 'control' },
      });
      await http()
        .delete(`/api-keys/${id}`)
        .set('X-API-Key', adminKey)
        .expect(200);

      await http().get('/health').set('X-API-Key', key).expect(200);
      await http().get('/api-keys').set('X-API-Key', key).expect(401);
    });

    it('records when a key was last used', async () => {
      await http().get('/api-keys').set('X-API-Key', adminKey).expect(200);

      const record = await t.prisma.apiKey.findFirstOrThrow({
        where: { name: 'Admin' },
      });
      await vi.waitFor(async () => {
        const fresh = await t.prisma.apiKey.findUniqueOrThrow({
          where: { id: record.id },
        });
        expect(fresh.lastUsedAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('access levels', () => {
    it.each(['read', 'control'] as const)(
      'forbids admin endpoints to a %s key',
      async (level) => {
        const key = await t.createKey(level);
        const res = await http()
          .get('/api-keys')
          .set('X-API-Key', key)
          .expect(403);
        expect(res.body.message).toContain('"admin"');
      },
    );
  });

  describe('/api-keys', () => {
    it('lists keys without their hash', async () => {
      const res = await http()
        .get('/api-keys')
        .set('X-API-Key', adminKey)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        name: 'Admin',
        level: 'admin',
        revokedAt: null,
      });
      expect(res.body[0].prefix).toMatch(/^wzs_.{8}$/);
      expect(res.body[0]).not.toHaveProperty('hash');
    });

    it('creates a key that works right away', async () => {
      const res = await http()
        .post('/api-keys')
        .set('X-API-Key', adminKey)
        .send({ name: 'Telefon', level: 'admin' })
        .expect(201);

      expect(res.body.apiKey).toMatchObject({
        name: 'Telefon',
        level: 'admin',
      });
      expect(res.body.key.startsWith(res.body.apiKey.prefix)).toBe(true);

      await http().get('/api-keys').set('X-API-Key', res.body.key).expect(200);
    });

    it('never stores the key itself', async () => {
      const res = await http()
        .post('/api-keys')
        .set('X-API-Key', adminKey)
        .send({ name: 'Telefon', level: 'read' })
        .expect(201);

      const record = await t.prisma.apiKey.findUniqueOrThrow({
        where: { id: res.body.apiKey.id },
      });
      expect(JSON.stringify(record)).not.toContain(res.body.key);
    });

    it.each([
      [{ name: 'x', level: 'root' }],
      [{ name: '', level: 'read' }],
      [{ name: 'x'.repeat(65), level: 'read' }],
      [{ level: 'read' }],
      [{ name: 'x', level: 'read', extra: true }],
    ])('rejects the invalid body %j', async (body) => {
      await http()
        .post('/api-keys')
        .set('X-API-Key', adminKey)
        .send(body)
        .expect(400);
    });

    it('refuses to revoke the last active admin key', async () => {
      const { id } = await t.prisma.apiKey.findFirstOrThrow();

      await http()
        .delete(`/api-keys/${id}`)
        .set('X-API-Key', adminKey)
        .expect(409);
    });

    it('revokes an admin key when another admin remains', async () => {
      const { id } = await t.prisma.apiKey.findFirstOrThrow();
      const second = await t.createKey('admin', 'Second admin');

      const res = await http()
        .delete(`/api-keys/${id}`)
        .set('X-API-Key', second)
        .expect(200);
      expect(res.body.revokedAt).not.toBeNull();
    });

    it('answers 404 for an unknown key id', async () => {
      await http()
        .delete('/api-keys/9999')
        .set('X-API-Key', adminKey)
        .expect(404);
    });
  });

  describe('OpenAPI', () => {
    it('serves the document without a key, with the API key scheme', async () => {
      const res = await http().get('/docs-json').expect(200);

      expect(res.body.components.securitySchemes['api-key']).toEqual({
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      });
      expect(Object.keys(res.body.paths)).toEqual(
        expect.arrayContaining(['/health', '/api-keys', '/api-keys/{id}']),
      );
    });
  });
});
