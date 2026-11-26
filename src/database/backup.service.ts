import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { PrismaService } from './prisma.service.js';

const FILE_PATTERN = /^wizsla-\d{8}-\d{6}\.db$/;

/**
 * Copies the database with `VACUUM INTO`, which gives a consistent snapshot
 * while the service keeps running, and keeps the newest BACKUP_KEEP copies.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  readonly dir: string;
  readonly keep: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.dir = resolve(config.get('BACKUP_DIR', { infer: true }));
    this.keep = config.get('BACKUP_KEEP', { infer: true });
  }

  get enabled(): boolean {
    return this.keep > 0;
  }

  /** Makes a backup now and returns its path. */
  async backup(now = new Date()): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const file = join(this.dir, `wizsla-${stamp(now)}.db`);
    await this.prisma.$executeRawUnsafe('VACUUM INTO ?', file);
    await this.prune();
    this.logger.log(`Database backed up to ${file}`);
    return file;
  }

  /** When the newest backup was made, or `null` if there is none. */
  async latest(): Promise<Date | null> {
    const [newest] = await this.files();
    if (!newest) return null;
    return (await stat(join(this.dir, newest))).mtime;
  }

  /** Backup files, newest first. */
  private async files(): Promise<string[]> {
    try {
      const names = await readdir(this.dir);
      return names
        .filter((n) => FILE_PATTERN.test(n))
        .sort()
        .reverse();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  /** With backups turned off, manual backups are never deleted. */
  private async prune(): Promise<void> {
    if (this.keep === 0) return;
    const old = (await this.files()).slice(this.keep);
    await Promise.all(old.map((name) => rm(join(this.dir, name))));
  }
}

/** `20261126-103000` in UTC; sorts by time as text. */
function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}
