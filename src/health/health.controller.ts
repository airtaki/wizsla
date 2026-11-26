import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators.js';

export class HealthStatus {
  status!: 'ok';
  /** Seconds since the service started. */
  uptime!: number;
}

/** Public, so that monitoring (Uptime Kuma) needs no API key. */
@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
