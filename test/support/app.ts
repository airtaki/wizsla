import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import type { AccessLevel } from '../../src/auth/access-level.js';
import { ApiKeysService } from '../../src/auth/api-keys.service.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { setupSwagger } from '../../src/swagger.js';

export interface TestApp {
  app: INestApplication<App>;
  prisma: PrismaService;
  /** Creates a key directly in the database and returns the full key. */
  createKey(level: AccessLevel, name?: string): Promise<string>;
  /** Empties every table, so each test starts from a clean database. */
  reset(): Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>({
    logger: ['error'],
  });
  setupSwagger(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const apiKeys = app.get(ApiKeysService);

  return {
    app,
    prisma,
    async createKey(level, name = `${level} key`) {
      return (await apiKeys.create(name, level)).key;
    },
    async reset() {
      await prisma.bulb.deleteMany();
      await prisma.room.deleteMany();
      await prisma.apiKey.deleteMany();
    },
  };
}
