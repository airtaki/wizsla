import { sceneName } from './colors';
import type { BulbState } from './model';

/** One line about a bulb: off, unreachable, or what it shows. */
export function describeBulb(bulb: BulbState): string {
  if (!bulb.enabled) return 'Letiltva';
  if (bulb.online === false) return 'Nem elérhető';
  if (bulb.online === null || !bulb.state) return 'Ismeretlen';
  const light = bulb.state;
  if (!light.on) return 'Kikapcsolva';
  const brightness =
    light.brightness === undefined ? null : `${light.brightness}%`;
  const what =
    light.mode === 'scene' && light.scene
      ? sceneName(light.scene)
      : light.mode === 'color'
        ? 'színes'
        : light.colorTemp !== undefined
          ? `${light.colorTemp} K`
          : null;
  return [brightness, what].filter(Boolean).join(' · ') || 'Bekapcsolva';
}

/** "3/6 ég", or why nothing does. */
export function describeGroup(bulbs: BulbState[]): string {
  const enabled = bulbs.filter((b) => b.enabled);
  if (enabled.length === 0) return 'Nincs izzó';
  const reachable = enabled.filter((b) => b.online === true);
  const lit = reachable.filter((b) => b.state?.on).length;
  const missing = enabled.length - reachable.length;
  const main =
    reachable.length === 0
      ? 'Nem elérhető'
      : lit === 0
        ? 'Lekapcsolva'
        : `${lit}/${enabled.length} ég`;
  return missing > 0 && reachable.length > 0
    ? `${main} · ${missing} nem elérhető`
    : main;
}

export function signalLabel(rssi: number): string {
  if (rssi >= -60) return 'erős';
  if (rssi >= -70) return 'jó';
  if (rssi >= -80) return 'közepes';
  return 'gyenge';
}
