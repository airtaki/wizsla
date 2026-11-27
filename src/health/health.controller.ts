import { readFileSync } from 'node:fs';
import { Controller, Get, Logger, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators.js';
import { BackupService } from '../database/backup.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { StateService } from '../state/state.service.js';
import { type HealthBulbs, HealthStatus } from './health.dto.js';

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string };

/**
 * Public, so that monitoring (Uptime Kuma) needs no API key. Answers from
 * the database and memory only; it never waits for a bulb.
 */
@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly state: StateService,
    private readonly backups: BackupService,
  ) {}

  @Get()
  async check(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthStatus> {
    const uptime = Math.round(process.uptime());
    const lastBackup = await this.backups.latest().catch(() => null);

    let bulbs: HealthBulbs;
    try {
      const enabled = await this.prisma.bulb.findMany({
        where: { enabled: true },
        select: { id: true },
      });
      bulbs = {
        total: enabled.length,
        online: enabled.filter((b) => this.state.isOnline(b.id)).length,
      };
    } catch (error) {
      this.logger.error(`Database check failed: ${(error as Error).message}`);
      res.status(503);
      return {
        status: 'error',
        version,
        node: process.version,
        uptime,
        database: 'error',
        bulbs: null,
        lastBackup,
      };
    }

    return {
      status: 'ok',
      version,
      node: process.version,
      uptime,
      database: 'ok',
      bulbs,
      lastBackup,
    };
  }
}
