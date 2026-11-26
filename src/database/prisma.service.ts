import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import type { Env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

/** Turns `file:./data/x.db` into an absolute path under the working directory. */
export function sqlitePath(databaseUrl: string): string {
  return resolve(databaseUrl.replace(/^file:/, ''));
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService<Env, true>) {
    const file = sqlitePath(config.get('DATABASE_URL', { infer: true }));
    // SQLite creates the file but not its directory.
    mkdirSync(dirname(file), { recursive: true });
    super({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
