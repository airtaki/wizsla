import { mkdtemp, readdir, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import request from 'supertest';
import type { Env } from '../src/config/env.js';
import { BackupScheduler } from '../src/database/backup.scheduler.js';
import { BackupService } from '../src/database/backup.service.js';
import { createTestApp, type TestApp } from './support/app.js';
import { FakeWizBulb } from './support/fake-wiz-bulb.js';

describe('Health and backups (e2e)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    await t.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /health', () => {
    it('reports the service, database and bulbs without a key', async () => {
      const res = await http().get('/health').expect(200);
      expect(res.body).toEqual({
        status: 'ok',
        version: expect.stringMatching(/^\d+\.\d+\.\d+/),
        node: process.version,
        uptime: expect.any(Number),
        database: 'ok',
        bulbs: { total: 0, online: 0 },
        lastBackup: null,
      });
    });

    it('counts enabled bulbs that answered their last check', async () => {
      const fake = await FakeWizBulb.start();
      const silent = await FakeWizBulb.start({ mac: 'a8bb50000002' });
      silent.silent = true;
      try {
        let n = 0;
        for (const bulb of [fake, silent]) {
          n++;
          await t.prisma.bulb.create({
            data: {
              mac: n === 1 ? 'a8bb50000001' : 'a8bb50000002',
              name: `Lámpa ${n}`,
              slug: `lampa-${n}`,
              ...bulb.address,
            },
          });
        }
        await t.prisma.bulb.create({
          data: {
            mac: 'a8bb50000003',
            name: 'Letiltott',
            slug: 'letiltott',
            ip: '127.0.0.1',
            enabled: false,
          },
        });

        // Nothing checked yet: health never asks the bulbs itself.
        const before = await http().get('/health').expect(200);
        expect(before.body.bulbs).toEqual({ total: 2, online: 0 });
        expect(fake.received).toEqual([]);

        const read = await t.createKey('read');
        await http()
          .get('/state?refresh=true')
          .set('X-API-Key', read)
          .expect(200);
        const after = await http().get('/health').expect(200);
        expect(after.body.bulbs).toEqual({ total: 2, online: 1 });
      } finally {
        await fake.stop();
        await silent.stop();
      }
    });

    it('answers 503 when the database fails', async () => {
      vi.spyOn(t.prisma.bulb, 'findMany').mockRejectedValueOnce(
        new Error('disk I/O error'),
      );
      const res = await http().get('/health').expect(503);
      expect(res.body).toMatchObject({
        status: 'error',
        database: 'error',
        bulbs: null,
      });
    });
  });

  describe('backups', () => {
    let dir: string;
    const service = (keep: number) =>
      new BackupService(t.prisma, {
        get: (key: string) => (key === 'BACKUP_DIR' ? dir : keep),
      } as unknown as ConfigService<Env, true>);

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'wizsla-backup-'));
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it('copies the database, which can be opened and read', async () => {
      await t.prisma.room.create({
        data: { name: 'Nappali', slug: 'nappali' },
      });
      const file = await service(3).backup(new Date('2026-11-26T10:30:00Z'));
      expect(file).toBe(join(dir, 'wizsla-20261126-103000.db'));

      const { DatabaseSync } = await import('node:sqlite');
      const copy = new DatabaseSync(file, { readOnly: true });
      try {
        expect(copy.prepare('select slug from Room').all()).toEqual([
          { slug: 'nappali' },
        ]);
      } finally {
        copy.close();
      }
    });

    it('keeps the newest copies only', async () => {
      const backups = service(2);
      for (const day of [1, 2, 3, 4]) {
        await backups.backup(new Date(`2026-11-0${day}T03:00:00Z`));
      }
      expect((await readdir(dir)).sort()).toEqual([
        'wizsla-20261103-030000.db',
        'wizsla-20261104-030000.db',
      ]);
    });

    it('never deletes when automatic backups are off', async () => {
      const backups = service(0);
      expect(backups.enabled).toBe(false);
      await backups.backup(new Date('2026-11-01T03:00:00Z'));
      await backups.backup(new Date('2026-11-02T03:00:00Z'));
      expect(await readdir(dir)).toHaveLength(2);
    });

    it('backs up once a day, whenever the service runs', async () => {
      const backups = service(5);
      const scheduler = new BackupScheduler(backups);
      const day = 24 * 60 * 60_000;

      await scheduler.check(new Date());
      expect(await readdir(dir)).toHaveLength(1);

      await scheduler.check(new Date(Date.now() + day / 2));
      expect(await readdir(dir)).toHaveLength(1);

      // The newest backup is judged by its file time.
      const [file] = await readdir(dir);
      const old = new Date(Date.now() - day - 60_000);
      await utimes(join(dir, file!), old, old);
      await scheduler.check(new Date(Date.now() + 1000));
      expect(await readdir(dir)).toHaveLength(2);
      expect(await backups.latest()).toBeInstanceOf(Date);
    });
  });

  it('answers unknown routes with 404', async () => {
    await http().get('/nope').expect(404);
  });
});
