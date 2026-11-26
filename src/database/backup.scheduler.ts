import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { BackupService } from './backup.service.js';

const CHECK_EVERY_MS = 60 * 60_000;
const BACKUP_EVERY_MS = 24 * 60 * 60_000;

/**
 * Makes a backup when the newest one is a day old. Checks at startup and
 * then hourly, so restarts neither skip nor repeat a day.
 */
@Injectable()
export class BackupScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(BackupScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly backups: BackupService) {}

  onApplicationBootstrap(): void {
    if (!this.backups.enabled) {
      this.logger.log('Database backups are off (BACKUP_KEEP=0)');
      return;
    }
    void this.check();
    this.timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async check(now = new Date()): Promise<void> {
    try {
      const latest = await this.backups.latest();
      if (latest && now.getTime() - latest.getTime() < BACKUP_EVERY_MS) return;
      await this.backups.backup(now);
    } catch (error) {
      this.logger.error(`Database backup failed: ${(error as Error).message}`);
    }
  }
}
