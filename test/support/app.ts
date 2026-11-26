import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import type { AccessLevel } from '../../src/auth/access-level.js';
import { ApiKeysService } from '../../src/auth/api-keys.service.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { setupSwagger } from '../../src/swagger.js';
import { setupWebApp } from '../../src/web.js';

export interface TestApp {
  app: NestExpressApplication;
  prisma: PrismaService;
  /** Creates a key directly in the database and returns the full key. */
  createKey(level: AccessLevel, name?: string): Promise<string>;
  /** Empties every table, so each test starts from a clean database. */
  reset(): Promise<void>;
}

export interface TestAppOptions {
  /** Serve this directory as the web app (see `setupWebApp`). */
  webDir?: string;
}

export async function createTestApp(
  options: TestAppOptions = {},
): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: ['error'],
  });
  setupSwagger(app);
  if (options.webDir) setupWebApp(app, options.webDir);
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
      await prisma.commandLog.deleteMany();
      await prisma.bulb.deleteMany();
      await prisma.room.deleteMany();
      await prisma.apiKey.deleteMany();
    },
  };
}
