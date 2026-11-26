import { readFileSync } from 'node:fs';
import { Controller, Get, Logger, Res } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators.js';
import { BackupService } from '../database/backup.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { StateService } from '../state/state.service.js';

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string };

export class HealthBulbs {
  /** Enabled bulbs. */
  total!: number;
  /** Enabled bulbs that answered their last check. */
  online!: number;
}

export class HealthStatus {
  /** `error` (with HTTP 503) when the database cannot be reached. */
  @ApiProperty({ enum: ['ok', 'error'] })
  status!: 'ok' | 'error';

  version!: string;

  /** Seconds since the service started. */
  uptime!: number;

  @ApiProperty({ enum: ['ok', 'error'] })
  database!: 'ok' | 'error';

  /** From the background poll; offline bulbs do not make the service unhealthy. */
  @ApiProperty({ type: HealthBulbs, nullable: true })
  bulbs!: HealthBulbs | null;

  /** When the newest database backup was made. */
  @ApiProperty({ type: Date, nullable: true })
  lastBackup!: Date | null;
}

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
        uptime,
        database: 'error',
        bulbs: null,
        lastBackup,
      };
    }

    return { status: 'ok', version, uptime, database: 'ok', bulbs, lastBackup };
  }
}
