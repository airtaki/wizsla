import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { UdpTransport } from './udp-transport.js';
import { WizClient } from './wiz-client.js';

/** Network settings used when talking to bulbs. */
export class WizSettings {
  constructor(
    readonly broadcastAddress: string,
    readonly port: number,
    readonly discoveryMs: number,
  ) {}
}

/**
 * Nest wiring for the (framework-independent) Wiz protocol layer: one shared
 * client, so commands to the same bulb are always sent in order.
 */
@Global()
@Module({
  providers: [
    {
      provide: WizClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new WizClient(
          new UdpTransport({
            timeoutMs: config.get('WIZ_TIMEOUT_MS', { infer: true }),
            retries: config.get('WIZ_RETRIES', { infer: true }),
          }),
        ),
    },
    {
      provide: WizSettings,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new WizSettings(
          config.get('WIZ_BROADCAST_ADDRESS', { infer: true }),
          config.get('WIZ_PORT', { infer: true }),
          config.get('WIZ_DISCOVERY_MS', { infer: true }),
        ),
    },
  ],
  exports: [WizClient, WizSettings],
})
export class WizModule {}
