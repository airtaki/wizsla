import { isIPv4 } from 'node:net';
import { z } from 'zod';
import {
  WizCommandError,
  WizInvalidParamsError,
  WizProtocolError,
} from './errors.js';
import { KeyedQueue } from './keyed-queue.js';
import {
  type BulbAddress,
  type BulbState,
  envelopeSchema,
  formatAddress,
  type ModelConfig,
  modelConfigSchema,
  pilotSchema,
  registrationResultSchema,
  type SetPilotParams,
  setPilotParamsSchema,
  setPilotResultSchema,
  type SystemConfig,
  systemConfigSchema,
  toBulbState,
  type WizMethod,
} from './protocol.js';
import { UdpTransport } from './udp-transport.js';

/** JSON-RPC "Method not found", answered by older firmware. */
const METHOD_NOT_FOUND = -32601;

function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, part) => acc * 256 + Number(part), 0);
}

export interface DiscoveredBulb {
  ip: string;
  mac: string;
}

export interface DiscoverOptions {
  /** Defaults to the limited broadcast address. */
  broadcastAddress?: string;
  port?: number;
  durationMs?: number;
}

/**
 * High-level client for the Wiz local UDP protocol.
 *
 * Validates parameters before sending, validates every answer, and sends
 * requests to the same bulb strictly one after another.
 */
export class WizClient {
  constructor(
    private readonly transport: UdpTransport = new UdpTransport(),
    private readonly queue: KeyedQueue = new KeyedQueue(),
  ) {}

  async getPilot(address: BulbAddress): Promise<BulbState> {
    const result = await this.call(address, 'getPilot', {}, pilotSchema);
    return toBulbState(result);
  }

  async setPilot(address: BulbAddress, params: SetPilotParams): Promise<void> {
    const parsed = setPilotParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new WizInvalidParamsError(
        `invalid setPilot parameters: ${z.prettifyError(parsed.error)}`,
        formatAddress(address),
        'setPilot',
      );
    }
    await this.call(address, 'setPilot', parsed.data, setPilotResultSchema);
  }

  getSystemConfig(address: BulbAddress): Promise<SystemConfig> {
    return this.call(address, 'getSystemConfig', {}, systemConfigSchema);
  }

  /**
   * Model details such as the exact Kelvin range. Returns `null` when the
   * firmware does not know the method.
   */
  async getModelConfig(address: BulbAddress): Promise<ModelConfig | null> {
    try {
      return await this.call(address, 'getModelConfig', {}, modelConfigSchema);
    } catch (error) {
      if (error instanceof WizCommandError && error.code === METHOD_NOT_FOUND) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Finds Wiz devices on the local network. Read-only: the bulbs are asked
   * to identify themselves, nothing is registered or changed.
   */
  async discover(options: DiscoverOptions = {}): Promise<DiscoveredBulb[]> {
    const replies = await this.transport.broadcast(
      {
        method: 'registration',
        params: {
          phoneMac: 'AAAAAAAAAAAA',
          register: false,
          phoneIp: '1.2.3.4',
          id: '1',
        },
      },
      {
        address: options.broadcastAddress ?? '255.255.255.255',
        port: options.port,
        durationMs: options.durationMs ?? 2000,
        repeat: 3,
      },
    );

    const found = new Map<string, DiscoveredBulb>();
    for (const reply of replies) {
      const envelope = envelopeSchema.safeParse(reply.payload);
      if (!envelope.success || envelope.data.method !== 'registration') {
        continue;
      }
      const result = registrationResultSchema.safeParse(envelope.data.result);
      if (result.success) {
        found.set(result.data.mac, { ip: reply.ip, mac: result.data.mac });
      }
    }
    return [...found.values()].sort(
      (a, b) => ipToNumber(a.ip) - ipToNumber(b.ip),
    );
  }

  private async call<T extends z.ZodType>(
    address: BulbAddress,
    method: WizMethod,
    params: Record<string, unknown>,
    resultSchema: T,
  ): Promise<z.output<T>> {
    const target = formatAddress(address);
    if (!isIPv4(address.ip)) {
      throw new WizInvalidParamsError(
        `"${address.ip}" is not an IPv4 address`,
        target,
        method,
      );
    }

    const raw = await this.queue.run(target, () =>
      this.transport.request(address, { method, params }),
    );

    const envelope = envelopeSchema.safeParse(raw);
    if (!envelope.success) {
      throw new WizProtocolError(
        `unexpected answer from ${target}`,
        target,
        method,
      );
    }
    if (envelope.data.error) {
      const { code, message } = envelope.data.error;
      throw new WizCommandError(
        `${target} rejected ${method}: ${message ?? 'unknown error'}`,
        code,
        target,
        method,
      );
    }

    const result = resultSchema.safeParse(envelope.data.result);
    if (!result.success) {
      throw new WizProtocolError(
        `unexpected ${method} result from ${target}: ${z.prettifyError(result.error)}`,
        target,
        method,
      );
    }
    return result.data;
  }
}
