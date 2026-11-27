import { ApiProperty } from '@nestjs/swagger';

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

  /** The Node.js version the service runs on, e.g. `v24.22.3`. */
  node!: string;

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
