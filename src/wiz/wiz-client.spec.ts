import { FakeWizBulb } from '../../test/support/fake-wiz-bulb.js';
import {
  WizCommandError,
  WizInvalidParamsError,
  WizProtocolError,
  WizUnreachableError,
} from './errors.js';
import { UdpTransport } from './udp-transport.js';
import { WizClient } from './wiz-client.js';

describe('WizClient (against a simulated bulb)', () => {
  let bulb: FakeWizBulb;
  let client: WizClient;

  beforeEach(async () => {
    bulb = await FakeWizBulb.start({
      state: { state: true, dimming: 40, temp: 3000 },
    });
    client = new WizClient(new UdpTransport({ timeoutMs: 80, retries: 2 }));
  });

  afterEach(async () => {
    await bulb.stop();
  });

  describe('getPilot', () => {
    it('returns the normalised state', async () => {
      await expect(client.getPilot(bulb.address)).resolves.toEqual({
        mac: bulb.mac,
        on: true,
        mode: 'white',
        brightness: 40,
        colorTemp: 3000,
        rssi: -55,
      });
    });

    it('reports scene mode with speed', async () => {
      bulb.state = { state: true, dimming: 60, sceneId: 36, speed: 120 };

      await expect(client.getPilot(bulb.address)).resolves.toMatchObject({
        mode: 'scene',
        sceneId: 36,
        speed: 120,
      });
    });

    it('keeps the Kelvin of a static white scene', async () => {
      // Shape copied from a real bulb in Warm White.
      bulb.state = { state: true, sceneId: 11, temp: 2700, dimming: 100 };

      await expect(client.getPilot(bulb.address)).resolves.toMatchObject({
        mode: 'scene',
        sceneId: 11,
        colorTemp: 2700,
      });
    });

    it('reports colour mode with white channels', async () => {
      bulb.state = { state: true, r: 255, g: 128, b: 0, c: 0, w: 10 };

      await expect(client.getPilot(bulb.address)).resolves.toMatchObject({
        mode: 'color',
        color: { r: 255, g: 128, b: 0 },
        coldWhite: 0,
        warmWhite: 10,
      });
    });
  });

  describe('setPilot', () => {
    it('sends the parameters and the bulb applies them', async () => {
      await client.setPilot(bulb.address, { state: true, sceneId: 3 });

      expect(bulb.received.at(-1)).toEqual({
        method: 'setPilot',
        params: { state: true, sceneId: 3 },
      });
      await expect(client.getPilot(bulb.address)).resolves.toMatchObject({
        mode: 'scene',
        sceneId: 3,
      });
    });

    it('can set zero on a colour channel', async () => {
      await client.setPilot(bulb.address, { r: 0, g: 0, b: 255, w: 0 });

      expect(bulb.received.at(-1)?.params).toEqual({
        r: 0,
        g: 0,
        b: 255,
        w: 0,
      });
    });

    it.each([
      [{}, 'at least one parameter'],
      [{ dimming: 5 }, 'dimming'],
      [{ dimming: 101 }, 'dimming'],
      [{ dimming: 50.5 }, 'dimming'],
      [{ r: 256, g: 0, b: 0 }, 'r'],
      [{ r: 10 }, 'r, g and b must be given together'],
      [{ temp: 3000, sceneId: 3 }, 'only one of'],
      [{ temp: 3000, r: 1, g: 2, b: 3 }, 'only one of'],
      [{ sceneId: 999 }, 'unknown sceneId'],
      [{ sceneId: 14, dimming: 50 }, 'does not support dimming'],
      [{ sceneId: 11, speed: 100 }, 'does not support speed'],
      [{ brightness: 50 }, 'brightness'],
    ])('rejects %j before sending', async (params, message) => {
      await expect(
        client.setPilot(bulb.address, params as never),
      ).rejects.toThrow(
        expect.objectContaining({
          name: WizInvalidParamsError.name,
          message: expect.stringContaining(message),
        }),
      );
      expect(bulb.received).toHaveLength(0);
    });

    it('surfaces a rejection from the bulb', async () => {
      bulb.rawReply = JSON.stringify({
        method: 'setPilot',
        error: { code: -32600, message: 'Invalid Request' },
      });

      const error = await client
        .setPilot(bulb.address, { state: true })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(WizCommandError);
      expect(error).toMatchObject({ code: -32600, method: 'setPilot' });
    });

    it('treats a reply without success as a protocol error', async () => {
      bulb.rawReply = JSON.stringify({
        method: 'setPilot',
        result: { success: false },
      });

      await expect(
        client.setPilot(bulb.address, { state: true }),
      ).rejects.toBeInstanceOf(WizProtocolError);
    });
  });

  describe('unreliable network', () => {
    it('resends after lost packets', async () => {
      bulb.dropNext = 2;

      await expect(client.getPilot(bulb.address)).resolves.toMatchObject({
        on: true,
      });
      expect(bulb.received).toHaveLength(3);
    });

    it('gives up after the last retry', async () => {
      bulb.silent = true;

      const error = await client
        .getPilot(bulb.address)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(WizUnreachableError);
      expect((error as Error).message).toContain('after 3 attempts');
      expect(bulb.received).toHaveLength(3);
    });

    it('accepts a late answer to an earlier attempt', async () => {
      bulb.delayMs = 120; // slower than one attempt, faster than all three

      await expect(client.getPilot(bulb.address)).resolves.toMatchObject({
        on: true,
      });
    });

    it('rejects invalid JSON', async () => {
      bulb.rawReply = 'not json';

      await expect(client.getPilot(bulb.address)).rejects.toBeInstanceOf(
        WizProtocolError,
      );
    });

    it('rejects a reply that does not match the schema', async () => {
      bulb.rawReply = JSON.stringify({
        method: 'getPilot',
        result: { state: 'yes' },
      });

      await expect(client.getPilot(bulb.address)).rejects.toBeInstanceOf(
        WizProtocolError,
      );
    });

    it('refuses host names', async () => {
      await expect(
        client.getPilot({ ip: 'localhost', port: bulb.address.port }),
      ).rejects.toBeInstanceOf(WizInvalidParamsError);
    });
  });

  describe('ordering', () => {
    it('sends commands to one bulb in submission order', async () => {
      bulb.delayMs = 20;

      await Promise.all(
        [10, 20, 30, 40, 50].map((dimming) =>
          client.setPilot(bulb.address, { dimming }),
        ),
      );

      expect(bulb.received.map((m) => m.params.dimming)).toEqual([
        10, 20, 30, 40, 50,
      ]);
      expect(bulb.state.dimming).toBe(50);
    });

    it('talks to different bulbs in parallel', async () => {
      const other = await FakeWizBulb.start({ mac: 'a8bb50000002' });
      const patient = new WizClient(new UdpTransport({ timeoutMs: 1000 }));
      bulb.delayMs = 150;
      other.delayMs = 150;

      const started = performance.now();
      await Promise.all([
        patient.getPilot(bulb.address),
        patient.getPilot(other.address),
      ]);
      await other.stop();

      // One after the other would take at least 300 ms.
      expect(performance.now() - started).toBeLessThan(270);
    });
  });

  describe('getModelConfig', () => {
    it('returns the Kelvin range and minimum dimming', async () => {
      await expect(client.getModelConfig(bulb.address)).resolves.toMatchObject({
        minDimLevel: 10,
        cctRange: [2200, 2700, 6500, 6500],
      });
    });

    it('returns null on firmware without the method', async () => {
      const old = await FakeWizBulb.start({ modelConfig: null });

      await expect(client.getModelConfig(old.address)).resolves.toBeNull();
      await old.stop();
    });
  });

  describe('getSystemConfig', () => {
    it('returns the module name and firmware', async () => {
      await expect(client.getSystemConfig(bulb.address)).resolves.toMatchObject(
        {
          mac: bulb.mac,
          moduleName: 'ESP01_SHRGB1C_31',
          fwVersion: '1.31.0',
        },
      );
    });
  });

  describe('discover', () => {
    it('lists each bulb once, even though it answers every repeat', async () => {
      const found = await client.discover({
        broadcastAddress: '127.0.0.1',
        port: bulb.address.port,
        durationMs: 150,
      });

      expect(found).toEqual([{ ip: '127.0.0.1', mac: bulb.mac }]);
      expect(bulb.received.map((m) => m.method)).toEqual([
        'registration',
        'registration',
        'registration',
      ]);
      expect(bulb.received[0]?.params.register).toBe(false);
    });
  });
});
