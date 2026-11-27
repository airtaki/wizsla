import { BadRequestException } from '@nestjs/common';
import {
  type BulbKind,
  capabilitiesForKind,
  type KelvinRange,
  kelvinRangeOf,
} from '../wiz/capabilities.js';
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  type BulbState,
  type SetPilotParams,
} from '../wiz/protocol.js';
import { findScene, type SceneDefinition } from '../wiz/scenes.js';
import type { LightCommandDto } from './control.dto.js';

/** A validated command, with the scene and colour already resolved. */
export interface Command {
  on?: boolean;
  brightness?: number;
  brightnessDelta?: number;
  colorTemp?: number;
  colorTempDelta?: number;
  color?: { r: number; g: number; b: number };
  coldWhite?: number;
  warmWhite?: number;
  scene?: SceneDefinition;
  speed?: number;
}

/** What a command needs to know about a bulb. */
export interface BulbTraits {
  kind: string;
  kelvinMin: number | null;
  kelvinMax: number | null;
}

export type Plan = { params: SetPilotParams } | { unsupported: string };

/** Checks the rules that span fields; throws 400 with a readable message. */
export function parseCommand(dto: LightCommandDto): Command {
  const given = (Object.keys(dto) as (keyof LightCommandDto)[]).filter(
    (key) => dto[key] !== undefined,
  );
  const fail = (message: string): never => {
    throw new BadRequestException(message);
  };

  if (given.length === 0) {
    fail(
      'Give at least one of on, brightness, brightnessDelta, colorTemp, colorTempDelta, color, scene or speed',
    );
  }
  if (dto.on === false && given.length > 1) {
    fail('on: false cannot be combined with other settings');
  }
  const modes = (
    ['color', 'colorTemp', 'colorTempDelta', 'scene'] as const
  ).filter((key) => dto[key] !== undefined);
  if (modes.length > 1) {
    fail(
      `Only one of color, colorTemp, colorTempDelta and scene; got ${modes.join(', ')}`,
    );
  }
  if (dto.speed !== undefined && modes.length > 0 && dto.scene === undefined) {
    fail(`speed is for scenes; it cannot be combined with ${modes.join(', ')}`);
  }
  if (dto.brightness !== undefined && dto.brightnessDelta !== undefined) {
    fail('Give brightness or brightnessDelta, not both');
  }
  if (
    (dto.coldWhite !== undefined || dto.warmWhite !== undefined) &&
    dto.color === undefined
  ) {
    fail('coldWhite and warmWhite need color');
  }

  let scene: SceneDefinition | undefined;
  if (dto.scene !== undefined) {
    scene = findScene(dto.scene);
    if (!scene) fail(`Unknown scene "${dto.scene}"; see GET /scenes`);
  }
  if (scene && dto.speed !== undefined && !scene.speedAdjustable) {
    fail(`The scene "${scene!.name}" has no adjustable speed`);
  }
  if (
    scene &&
    !scene.dimmable &&
    (dto.brightness !== undefined || dto.brightnessDelta !== undefined)
  ) {
    fail(`The scene "${scene!.name}" cannot be dimmed`);
  }

  return {
    on: dto.on,
    brightness: dto.brightness,
    brightnessDelta: dto.brightnessDelta,
    colorTemp: dto.colorTemp,
    colorTempDelta: dto.colorTempDelta,
    color: dto.color === undefined ? undefined : hexToRgb(dto.color),
    coldWhite: dto.coldWhite,
    warmWhite: dto.warmWhite,
    scene,
    speed: dto.speed,
  };
}

/**
 * Deltas are relative to what the bulb shows now, and a speed without a
 * scene is for the scene it plays, so the bulb must be read first.
 */
export function needsCurrentState(command: Command): boolean {
  return (
    command.brightnessDelta !== undefined ||
    command.colorTempDelta !== undefined ||
    (command.speed !== undefined && !command.scene)
  );
}

/**
 * The setPilot parameters that carry out the command on one bulb, or why
 * this bulb cannot do it. `current` is needed for deltas only.
 */
export function planFor(
  bulb: BulbTraits,
  command: Command,
  current?: BulbState,
): Plan {
  const unsupported = (reason: string): Plan => ({ unsupported: reason });
  if (command.on === false) return { params: { state: false } };

  const kind = bulb.kind as BulbKind;
  const capabilities = capabilitiesForKind(kind);
  const kelvin: KelvinRange | null = kelvinRangeOf(bulb);
  const params: SetPilotParams = { state: true };

  if (
    command.brightness !== undefined ||
    command.brightnessDelta !== undefined
  ) {
    if (!capabilities.dimming) return unsupported('This bulb cannot be dimmed');
  }
  if (command.brightness !== undefined) params.dimming = command.brightness;

  if (command.brightnessDelta !== undefined) {
    if (!current) return unsupported('The current brightness is not known');
    const playing =
      current.mode === 'scene' ? findScene(current.sceneId ?? 0) : undefined;
    if (playing && !playing.dimmable && !command.scene) {
      return unsupported(`The scene "${playing.name}" cannot be dimmed`);
    }
    params.dimming = clamp(
      (current.brightness ?? BRIGHTNESS_MAX) + command.brightnessDelta,
      BRIGHTNESS_MIN,
      BRIGHTNESS_MAX,
    );
  }

  if (command.colorTemp !== undefined) {
    if (!kelvin) return unsupported('This bulb has no adjustable white');
    if (command.colorTemp < kelvin.min || command.colorTemp > kelvin.max) {
      return unsupported(
        `${command.colorTemp} K is outside this bulb's range (${kelvin.min}–${kelvin.max} K)`,
      );
    }
    params.temp = command.colorTemp;
  }

  if (command.colorTempDelta !== undefined) {
    if (!kelvin) return unsupported('This bulb has no adjustable white');
    // White mode, or a static white scene, which reports its Kelvin too.
    if (current?.colorTemp === undefined) {
      return unsupported(
        `The bulb does not report a colour temperature (${describeMode(current)}); set colorTemp instead`,
      );
    }
    params.temp = clamp(
      current.colorTemp + command.colorTempDelta,
      kelvin.min,
      kelvin.max,
    );
  }

  if (command.color) {
    if (!capabilities.color)
      return unsupported('This bulb cannot show colours');
    Object.assign(params, command.color);
    if (command.coldWhite !== undefined) params.c = command.coldWhite;
    if (command.warmWhite !== undefined) params.w = command.warmWhite;
  }

  if (command.scene) {
    if (!command.scene.supportedKinds.includes(kind)) {
      return unsupported(
        `This bulb cannot play the scene "${command.scene.name}"`,
      );
    }
    params.sceneId = command.scene.id;
  }

  if (command.speed !== undefined) {
    if (!capabilities.scenes) return unsupported('This bulb has no scenes');
    if (command.scene) {
      params.speed = command.speed;
    } else {
      return planSpeed(command, params, current);
    }
  }

  return { params };
}

/**
 * A new speed for the scene the bulb plays. Sent with `state: true` but no
 * scene, the firmware leaves the scene instead of changing its speed, so a
 * lit bulb gets the speed alone; anything else restarts the scene with it.
 */
function planSpeed(
  command: Command,
  params: SetPilotParams,
  current: BulbState | undefined,
): Plan {
  const playing =
    current?.mode === 'scene' ? findScene(current.sceneId ?? 0) : undefined;
  if (!playing) return { unsupported: 'No scene is playing' };
  if (!playing.speedAdjustable) {
    return {
      unsupported: `The scene "${playing.name}" has no adjustable speed`,
    };
  }
  const speedOnly = Object.keys(params).every((key) => key === 'state');
  if (speedOnly && current?.on) return { params: { speed: command.speed } };
  return { params: { ...params, sceneId: playing.id, speed: command.speed } };
}

function describeMode(state: BulbState | undefined): string {
  if (!state) return 'state unknown';
  if (state.mode === 'scene') {
    const scene = findScene(state.sceneId ?? 0);
    return `scene ${scene ? `"${scene.name}"` : state.sceneId}`;
  }
  return `${state.mode} mode`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
