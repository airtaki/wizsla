import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { StateService } from './state.service.js';

/**
 * Reads every bulb right after startup, then every WIZ_POLL_INTERVAL_MS.
 * The next round is scheduled only when the previous one has finished, so
 * slow or offline bulbs can never pile rounds up.
 */
@Injectable()
export class StatePoller implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(StatePoller.name);
  private readonly intervalMs: number;
  private timer?: NodeJS.Timeout;
  private stopped = false;

  constructor(
    private readonly state: StateService,
    config: ConfigService<Env, true>,
  ) {
    this.intervalMs = config.get('WIZ_POLL_INTERVAL_MS', { infer: true });
  }

  onApplicationBootstrap(): void {
    if (this.intervalMs === 0) {
      this.logger.log('Background polling is off (WIZ_POLL_INTERVAL_MS=0)');
      return;
    }
    this.schedule(0);
  }

  onModuleDestroy(): void {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.round(), delayMs);
  }

  private async round(): Promise<void> {
    try {
      await this.state.refreshAll();
    } catch (error) {
      this.logger.error(`Polling failed: ${(error as Error).message}`);
    }
    this.schedule(this.intervalMs);
  }
}
