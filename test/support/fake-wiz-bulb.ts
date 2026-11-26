import { createSocket, type RemoteInfo, type Socket } from 'node:dgram';

interface ReceivedMessage {
  method: string;
  params: Record<string, unknown>;
}

export interface FakeWizBulbOptions {
  mac?: string;
  moduleName?: string;
  state?: Record<string, unknown>;
  /** `null` simulates older firmware without `getModelConfig`. */
  modelConfig?: Record<string, unknown> | null;
}

/**
 * A Wiz bulb simulator listening on 127.0.0.1 (random port).
 *
 * It keeps a pilot state, answers getPilot / setPilot / getSystemConfig /
 * registration like a real bulb, and can be told to misbehave.
 */
export class FakeWizBulb {
  readonly received: ReceivedMessage[] = [];
  readonly mac: string;
  readonly moduleName: string;
  readonly modelConfig: Record<string, unknown> | null;
  state: Record<string, unknown>;

  /** Ignore this many incoming packets (simulates packet loss). */
  dropNext = 0;
  /** Never answer. */
  silent = false;
  /** Answer with this raw string instead of the normal reply. */
  rawReply?: string;
  /** Delay every answer by this many milliseconds. */
  delayMs = 0;

  private readonly pending = new Set<NodeJS.Timeout>();

  private constructor(
    private readonly socket: Socket,
    options: FakeWizBulbOptions,
  ) {
    this.mac = options.mac ?? 'a8bb50000001';
    this.moduleName = options.moduleName ?? 'ESP01_SHRGB1C_31';
    this.state = { state: false, dimming: 100, temp: 2700, ...options.state };
    // Shape copied from a real ESP24_SHRGBC_01 on firmware 1.38.0.
    this.modelConfig =
      options.modelConfig === undefined
        ? { minDimLevel: 10, cctRange: [2200, 2700, 6500, 6500] }
        : options.modelConfig;
    socket.on('message', (msg, from) => this.handle(msg, from));
  }

  static start(options: FakeWizBulbOptions = {}): Promise<FakeWizBulb> {
    const socket = createSocket('udp4');
    const bulb = new FakeWizBulb(socket, options);
    return new Promise((resolve) =>
      socket.bind(0, '127.0.0.1', () => resolve(bulb)),
    );
  }

  get address(): { ip: string; port: number } {
    return { ip: '127.0.0.1', port: this.socket.address().port };
  }

  stop(): Promise<void> {
    this.pending.forEach(clearTimeout);
    this.pending.clear();
    return new Promise((resolve) => this.socket.close(() => resolve()));
  }

  private handle(msg: Buffer, from: RemoteInfo): void {
    const request = JSON.parse(msg.toString('utf8')) as ReceivedMessage;
    this.received.push(request);

    if (this.silent) return;
    if (this.dropNext > 0) {
      this.dropNext -= 1;
      return;
    }

    const reply = this.rawReply ?? JSON.stringify(this.respond(request));
    const timer = setTimeout(() => {
      this.pending.delete(timer);
      this.socket.send(reply, from.port, from.address);
    }, this.delayMs);
    this.pending.add(timer);
  }

  private respond({ method, params }: ReceivedMessage): object {
    switch (method) {
      case 'getPilot':
        return {
          method,
          env: 'pro',
          result: { mac: this.mac, rssi: -55, src: '', ...this.state },
        };
      case 'setPilot':
        this.apply(params);
        return { method, env: 'pro', result: { success: true } };
      case 'getSystemConfig':
        return {
          method,
          env: 'pro',
          result: {
            mac: this.mac,
            moduleName: this.moduleName,
            fwVersion: '1.31.0',
            homeId: 1,
            roomId: 1,
          },
        };
      case 'getModelConfig':
        if (this.modelConfig === null) break;
        return { method, env: 'pro', result: this.modelConfig };
      case 'registration':
        return {
          method,
          env: 'pro',
          result: { mac: this.mac, success: true },
        };
    }
    return {
      method,
      env: 'pro',
      error: { code: -32601, message: 'Method not found' },
    };
  }

  private apply(params: Record<string, unknown>): void {
    const clear = (...keys: string[]) =>
      keys.forEach((key) => delete this.state[key]);

    if ('sceneId' in params) clear('temp', 'r', 'g', 'b', 'c', 'w');
    if ('temp' in params) clear('sceneId', 'speed', 'r', 'g', 'b', 'c', 'w');
    if ('r' in params || 'c' in params || 'w' in params) {
      clear('sceneId', 'speed', 'temp');
    }
    Object.assign(this.state, params);
  }
}
