import { createSocket, type RemoteInfo, type Socket } from 'node:dgram';
import { WizProtocolError, WizUnreachableError } from './errors.js';
import {
  type BulbAddress,
  formatAddress,
  WIZ_PORT,
  type WizRequest,
} from './protocol.js';

export interface UdpTransportOptions {
  /** How long to wait for an answer before resending. */
  timeoutMs: number;
  /** How many times to resend after the first attempt. */
  retries: number;
}

export const DEFAULT_TRANSPORT_OPTIONS: UdpTransportOptions = {
  timeoutMs: 1000,
  retries: 2,
};

export interface BroadcastOptions {
  address: string;
  port?: number;
  /** How long to collect answers. */
  durationMs: number;
  /** How many times to send the request during that time (UDP is lossy). */
  repeat: number;
}

export interface BroadcastReply {
  ip: string;
  payload: unknown;
}

/**
 * Sends JSON requests to Wiz bulbs over UDP.
 *
 * Every exchange uses its own short-lived socket, so an answer can only
 * belong to that request. Lost packets are resent; a late answer to an
 * earlier attempt is accepted as well. Every Wiz request is idempotent, so
 * resending is safe.
 */
export class UdpTransport {
  private readonly options: UdpTransportOptions;

  constructor(options: Partial<UdpTransportOptions> = {}) {
    this.options = { ...DEFAULT_TRANSPORT_OPTIONS, ...options };
  }

  request(address: BulbAddress, request: WizRequest): Promise<unknown> {
    const { timeoutMs, retries } = this.options;
    const target = formatAddress(address);
    const payload = Buffer.from(JSON.stringify(request));

    return new Promise((resolve, reject) => {
      const socket = createSocket('udp4');
      let attempts = 0;
      let timer: NodeJS.Timeout | undefined;
      let settled = false;

      const finish = (outcome: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        closeQuietly(socket);
        outcome();
      };

      const fail = (message: string, cause?: unknown): void =>
        finish(() =>
          reject(
            new WizUnreachableError(message, target, request.method, {
              cause,
            }),
          ),
        );

      const send = (): void => {
        attempts += 1;
        socket.send(payload, address.port ?? WIZ_PORT, address.ip, (err) => {
          if (err) fail(`failed to send to ${target}: ${err.message}`, err);
        });
        timer = setTimeout(() => {
          if (attempts > retries) {
            fail(`no answer from ${target} after ${attempts} attempts`);
          } else {
            send();
          }
        }, timeoutMs);
      };

      socket.on('error', (err) => fail(`socket error: ${err.message}`, err));

      socket.on('message', (message: Buffer, from: RemoteInfo) => {
        if (from.address !== address.ip) return;

        let parsed: unknown;
        try {
          parsed = JSON.parse(message.toString('utf8'));
        } catch (err) {
          finish(() =>
            reject(
              new WizProtocolError(
                `invalid JSON from ${target}`,
                target,
                request.method,
                { cause: err },
              ),
            ),
          );
          return;
        }

        // Ignore stray answers to a different method.
        if (isObject(parsed) && 'method' in parsed) {
          if (parsed.method !== request.method) return;
        }

        finish(() => resolve(parsed));
      });

      send();
    });
  }

  /** Broadcasts a request and collects every answer for a while. */
  broadcast(
    request: WizRequest,
    options: BroadcastOptions,
  ): Promise<BroadcastReply[]> {
    const payload = Buffer.from(JSON.stringify(request));
    const port = options.port ?? WIZ_PORT;
    const interval = options.durationMs / Math.max(options.repeat, 1);

    return new Promise((resolve, reject) => {
      const socket = createSocket('udp4');
      const replies: BroadcastReply[] = [];
      const timers: NodeJS.Timeout[] = [];

      const stop = (): void => {
        timers.forEach(clearTimeout);
        closeQuietly(socket);
      };

      socket.on('error', (err) => {
        stop();
        reject(
          new WizUnreachableError(
            `broadcast failed: ${err.message}`,
            `${options.address}:${port}`,
            request.method,
            { cause: err },
          ),
        );
      });

      socket.on('message', (message: Buffer, from: RemoteInfo) => {
        try {
          replies.push({
            ip: from.address,
            payload: JSON.parse(message.toString('utf8')),
          });
        } catch {
          // Not a Wiz answer; ignore it.
        }
      });

      socket.bind(() => {
        socket.setBroadcast(true);
        for (let i = 0; i < options.repeat; i++) {
          timers.push(
            setTimeout(() => {
              socket.send(payload, port, options.address);
            }, i * interval),
          );
        }
        timers.push(
          setTimeout(() => {
            stop();
            resolve(replies);
          }, options.durationMs),
        );
      });
    });
  }
}

function closeQuietly(socket: Socket): void {
  try {
    socket.close();
  } catch {
    // Already closed.
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
