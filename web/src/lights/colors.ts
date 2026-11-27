import { type BulbState, isLit, type LightState, rgbToHex } from './model';

/**
 * The colour of white light at `kelvin`, after Tanner Helland's
 * approximation of the black-body curve. Good enough for an indicator.
 */
export function kelvinToHex(kelvin: number): string {
  const t = kelvin / 100;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b =
    t >= 66
      ? 255
      : t <= 19
        ? 0
        : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const byte = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return rgbToHex({ r: byte(r), g: byte(g), b: byte(b) });
}

/** Hungarian names, by the Wiz firmware's scene id. */
const SCENE_NAMES: Record<number, string> = {
  1: 'Óceán',
  2: 'Romantika',
  3: 'Naplemente',
  4: 'Buli',
  5: 'Kandalló',
  6: 'Meghitt',
  7: 'Erdő',
  8: 'Pasztell',
  9: 'Ébresztő',
  10: 'Lefekvés',
  11: 'Meleg fehér',
  12: 'Nappali fény',
  13: 'Hideg fehér',
  14: 'Éjszakai fény',
  15: 'Fókusz',
  16: 'Pihenés',
  17: 'Valódi színek',
  18: 'Tévézés',
  19: 'Növények',
  20: 'Tavasz',
  21: 'Nyár',
  22: 'Ősz',
  23: 'Mélység',
  24: 'Dzsungel',
  25: 'Mojito',
  26: 'Klub',
  27: 'Karácsony',
  28: 'Halloween',
  29: 'Gyertyafény',
  30: 'Arany fehér',
  31: 'Pulzálás',
  32: 'Steampunk',
  33: 'Diwali',
  35: 'Riasztás',
  36: 'Havas égbolt',
};

/** Colours suggesting each scene, for its tile. */
const SCENE_COLORS: Record<number, string[]> = {
  1: ['#0ea5e9', '#1e3a8a'],
  2: ['#f43f5e', '#a21caf'],
  3: ['#f97316', '#db2777'],
  4: ['#ec4899', '#8b5cf6', '#22d3ee'],
  5: ['#f59e0b', '#dc2626'],
  6: ['#fb923c', '#fcd34d'],
  7: ['#15803d', '#a3e635'],
  8: ['#f9a8d4', '#a5b4fc', '#99f6e4'],
  9: ['#fde68a', '#fff7ed'],
  10: ['#fdba74', '#9a3412'],
  11: ['#ffc98a', '#ffe8c7'],
  12: ['#fff7e6', '#dbeafe'],
  13: ['#e0f2fe', '#bae6fd'],
  14: ['#fb923c', '#7c2d12'],
  15: ['#f8fafc', '#cbd5e1'],
  16: ['#fed7aa', '#fdba74'],
  17: ['#fef3c7', '#fde68a'],
  18: ['#c4b5fd', '#6366f1'],
  19: ['#e879f9', '#7c3aed'],
  20: ['#86efac', '#f9a8d4'],
  21: ['#fde047', '#22d3ee'],
  22: ['#ea580c', '#a16207'],
  23: ['#1d4ed8', '#0f766e'],
  24: ['#16a34a', '#facc15'],
  25: ['#84cc16', '#14b8a6'],
  26: ['#d946ef', '#2563eb'],
  27: ['#dc2626', '#16a34a'],
  28: ['#f97316', '#7e22ce'],
  29: ['#fbbf24', '#b45309'],
  30: ['#fcd34d', '#fef3c7'],
  31: ['#e5e7eb', '#9ca3af'],
  32: ['#b45309', '#78350f'],
  33: ['#f59e0b', '#e11d48'],
  35: ['#ef4444', '#7f1d1d'],
  36: ['#e0f2fe', '#94a3b8'],
};

export function sceneName(scene: { id: number; name: string }): string {
  return SCENE_NAMES[scene.id] ?? scene.name;
}

export function sceneGradient(id: number): string {
  const colors = SCENE_COLORS[id] ?? ['#a1a1aa', '#52525b'];
  return `linear-gradient(135deg, ${colors.join(', ')})`;
}

/** The colour a light shows, or `null` when it is off or unknown. */
export function lightColor(
  light: LightState | null | undefined,
): string | null {
  if (!light?.on) return null;
  if (light.mode === 'color' && light.color) return rgbToHex(light.color);
  if (light.colorTemp !== undefined) return kelvinToHex(light.colorTemp);
  if (light.mode === 'scene' && light.scene) {
    return (SCENE_COLORS[light.scene.id] ?? ['#fbbf24'])[0];
  }
  return '#fbbf24';
}

/** Distinct colours of the lit bulbs, for a room's indicator dots. */
export function litColors(bulbs: BulbState[], limit = 4): string[] {
  const colors = bulbs
    .filter(isLit)
    .map((b) => lightColor(b.state))
    .filter((c): c is string => c !== null);
  return [...new Set(colors)].slice(0, limit);
}

/** Quick colour choices for colour bulbs. */
export const SWATCHES = [
  '#ff3b30',
  '#ff9500',
  '#ffcc00',
  '#34c759',
  '#00c7be',
  '#30b0ff',
  '#007aff',
  '#5856d6',
  '#af52de',
  '#ff2d55',
];
