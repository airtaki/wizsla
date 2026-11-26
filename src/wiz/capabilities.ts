import type { ModelConfig } from './protocol.js';

/**
 * What a bulb can do, derived from the `moduleName` reported by
 * `getSystemConfig` (e.g. `ESP01_SHRGB1C_31`, `ESP56_SHTW3_01`).
 */
export type BulbKind =
  'rgb' | 'tunable-white' | 'dimmable-white' | 'socket' | 'unknown';

export interface KelvinRange {
  min: number;
  max: number;
}

export interface BulbCapabilities {
  kind: BulbKind;
  dimming: boolean;
  /** `null` when the bulb has no adjustable white temperature. */
  colorTemp: KelvinRange | null;
  color: boolean;
  scenes: boolean;
}

/**
 * Typical Kelvin ranges per kind, used when the firmware cannot report the
 * exact range of the model (`getModelConfig`).
 */
export const DEFAULT_KELVIN_RANGES = {
  rgb: { min: 2200, max: 6500 },
  'tunable-white': { min: 2700, max: 6500 },
} as const satisfies Partial<Record<BulbKind, KelvinRange>>;

export function bulbKindFromModule(moduleName: string): BulbKind {
  const family = moduleName.toUpperCase().split('_')[1] ?? '';
  if (family.includes('RGB')) return 'rgb';
  if (family.includes('TW')) return 'tunable-white';
  if (family.includes('DW')) return 'dimmable-white';
  if (family.includes('SOCKET')) return 'socket';
  return 'unknown';
}

export function capabilitiesForKind(kind: BulbKind): BulbCapabilities {
  switch (kind) {
    case 'rgb':
      return {
        kind,
        dimming: true,
        colorTemp: { ...DEFAULT_KELVIN_RANGES.rgb },
        color: true,
        scenes: true,
      };
    case 'tunable-white':
      return {
        kind,
        dimming: true,
        colorTemp: { ...DEFAULT_KELVIN_RANGES['tunable-white'] },
        color: false,
        scenes: true,
      };
    case 'dimmable-white':
      return {
        kind,
        dimming: true,
        colorTemp: null,
        color: false,
        scenes: true,
      };
    case 'socket':
    case 'unknown':
      return {
        kind,
        dimming: false,
        colorTemp: null,
        color: false,
        scenes: false,
      };
  }
}

/**
 * Capabilities from `getSystemConfig`, refined with `getModelConfig` when
 * the firmware provides it (the exact Kelvin range of the model).
 */
export function capabilitiesFromModule(
  moduleName: string,
  modelConfig?: ModelConfig | null,
): BulbCapabilities {
  const capabilities = capabilitiesForKind(bulbKindFromModule(moduleName));
  const cct = modelConfig?.cctRange;
  if (capabilities.colorTemp && cct) {
    capabilities.colorTemp = { min: cct[0], max: cct[3] };
  }
  return capabilities;
}
