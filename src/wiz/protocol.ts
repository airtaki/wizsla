import { z } from 'zod';
import { findScene } from './scenes.js';

/** UDP port every Wiz bulb listens on. */
export const WIZ_PORT = 38899;

export type WizMethod =
  | 'getPilot'
  | 'setPilot'
  | 'getSystemConfig'
  | 'getModelConfig'
  | 'registration';

export interface WizRequest {
  method: WizMethod;
  params: Record<string, unknown>;
}

export interface BulbAddress {
  ip: string;
  /** Defaults to {@link WIZ_PORT}; only tests and simulators override it. */
  port?: number;
}

export function formatAddress(address: BulbAddress): string {
  return `${address.ip}:${address.port ?? WIZ_PORT}`;
}

// ---------------------------------------------------------------------------
// Responses (untrusted input from the network, so they are validated)

const channel = z.number().int().min(0).max(255);

export const envelopeSchema = z.looseObject({
  method: z.string().optional(),
  result: z.looseObject({}).optional(),
  error: z
    .looseObject({
      code: z.number().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

export const pilotSchema = z.looseObject({
  mac: z.string(),
  rssi: z.number().optional(),
  state: z.boolean(),
  sceneId: z.number().int().optional(),
  speed: z.number().int().optional(),
  temp: z.number().int().optional(),
  dimming: z.number().int().optional(),
  r: channel.optional(),
  g: channel.optional(),
  b: channel.optional(),
  c: channel.optional(),
  w: channel.optional(),
});

export const systemConfigSchema = z.looseObject({
  mac: z.string(),
  moduleName: z.string(),
  fwVersion: z.string().optional(),
  homeId: z.number().optional(),
  roomId: z.number().optional(),
});

export const setPilotResultSchema = z.looseObject({
  success: z.literal(true),
});

export const registrationResultSchema = z.looseObject({
  mac: z.string(),
});

/** Only answered by newer firmware (seen on 1.38). */
export const modelConfigSchema = z.looseObject({
  /** `[extendedMin, min, max, extendedMax]` in Kelvin. */
  cctRange: z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .optional(),
  minDimLevel: z.number().int().optional(),
});

export type SystemConfig = z.infer<typeof systemConfigSchema>;
export type ModelConfig = z.infer<typeof modelConfigSchema>;

// ---------------------------------------------------------------------------
// Normalised bulb state

export type LightMode = 'scene' | 'white' | 'color' | 'unknown';

export interface BulbState {
  mac: string;
  on: boolean;
  mode: LightMode;
  brightness?: number;
  sceneId?: number;
  colorTemp?: number;
  color?: { r: number; g: number; b: number };
  coldWhite?: number;
  warmWhite?: number;
  speed?: number;
  /** Wi-Fi signal strength in dBm. */
  rssi?: number;
}

export function toBulbState(pilot: z.infer<typeof pilotSchema>): BulbState {
  const state: BulbState = {
    mac: pilot.mac,
    on: pilot.state,
    mode: 'unknown',
    brightness: pilot.dimming,
    rssi: pilot.rssi,
  };

  if (pilot.sceneId !== undefined && pilot.sceneId > 0) {
    state.mode = 'scene';
    state.sceneId = pilot.sceneId;
    state.speed = pilot.speed;
    // Static white scenes (Warm White, Daylight...) report their Kelvin;
    // dynamic ones do not.
    if (pilot.temp !== undefined && pilot.temp > 0) {
      state.colorTemp = pilot.temp;
    }
  } else if (pilot.temp !== undefined && pilot.temp > 0) {
    state.mode = 'white';
    state.colorTemp = pilot.temp;
  } else if (
    pilot.r !== undefined &&
    pilot.g !== undefined &&
    pilot.b !== undefined
  ) {
    state.mode = 'color';
    state.color = { r: pilot.r, g: pilot.g, b: pilot.b };
    state.coldWhite = pilot.c;
    state.warmWhite = pilot.w;
  }

  return state;
}

// ---------------------------------------------------------------------------
// setPilot parameters (validated before anything is sent)

export const BRIGHTNESS_MIN = 10;
export const BRIGHTNESS_MAX = 100;
export const SPEED_MIN = 10;
export const SPEED_MAX = 200;
/** Protocol-level bounds; each bulb model has a narrower range. */
export const KELVIN_MIN = 1000;
export const KELVIN_MAX = 10000;

export const setPilotParamsSchema = z
  .strictObject({
    state: z.boolean().optional(),
    dimming: z
      .number()
      .int()
      .min(BRIGHTNESS_MIN)
      .max(BRIGHTNESS_MAX)
      .optional(),
    temp: z.number().int().min(KELVIN_MIN).max(KELVIN_MAX).optional(),
    sceneId: z.number().int().optional(),
    speed: z.number().int().min(SPEED_MIN).max(SPEED_MAX).optional(),
    r: channel.optional(),
    g: channel.optional(),
    b: channel.optional(),
    c: channel.optional(),
    w: channel.optional(),
  })
  .superRefine((p, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', message });

    if (Object.values(p).every((v) => v === undefined)) {
      issue('at least one parameter is required');
    }

    const rgb = [p.r, p.g, p.b].filter((v) => v !== undefined).length;
    if (rgb !== 0 && rgb !== 3) issue('r, g and b must be given together');

    const hasColor = [p.r, p.g, p.b, p.c, p.w].some((v) => v !== undefined);
    const modes = [p.sceneId !== undefined, p.temp !== undefined, hasColor];
    if (modes.filter(Boolean).length > 1) {
      issue('only one of sceneId, temp or color channels may be given');
    }

    if (p.sceneId !== undefined) {
      const scene = findScene(p.sceneId);
      if (!scene) {
        issue(`unknown sceneId ${p.sceneId}`);
      } else {
        if (p.speed !== undefined && !scene.speedAdjustable) {
          issue(`scene "${scene.name}" does not support speed`);
        }
        if (p.dimming !== undefined && !scene.dimmable) {
          issue(`scene "${scene.name}" does not support dimming`);
        }
      }
    }
  });

export type SetPilotParams = z.input<typeof setPilotParamsSchema>;
