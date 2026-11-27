import { sceneName } from '../lights/colors';
import type { Scene } from '../lights/model';
import type { CommandLogEntry } from './queries';

export const KIND_LABELS: Record<string, string> = {
  rgb: 'Színes',
  'tunable-white': 'Hangolható fehér',
  'dimmable-white': 'Szabályozható fehér',
  socket: 'Konnektor',
  unknown: 'Ismeretlen',
};

export const LEVEL_HINTS = {
  read: 'Csak nézheti az állapotot (pl. kijelző).',
  control: 'Kapcsolhatja és állíthatja a lámpákat.',
  admin: 'Mindent, a beállításokat is.',
} as const;

const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

function describeScene(ref: unknown, scenes: Scene[]): string {
  const scene = scenes.find(
    (s) =>
      s.id === ref ||
      s.slug === ref ||
      (typeof ref === 'string' && s.name.toLowerCase() === ref.toLowerCase()),
  );
  return scene ? sceneName(scene) : String(ref);
}

/** A logged command in words: "Fényerő 40% · Jelenet: Naplemente". */
export function describeCommand(
  command: Record<string, unknown>,
  scenes: Scene[] = [],
): string {
  if (command.on === false) return 'Kikapcsolás';
  const parts: string[] = [];
  const n = (key: string) =>
    typeof command[key] === 'number' ? (command[key] as number) : undefined;

  if (n('brightness') !== undefined) parts.push(`Fényerő ${n('brightness')}%`);
  if (n('brightnessDelta') !== undefined) {
    parts.push(`Fényerő ${signed(n('brightnessDelta')!)}%`);
  }
  if (n('colorTemp') !== undefined) parts.push(`Fehér ${n('colorTemp')} K`);
  if (n('colorTempDelta') !== undefined) {
    parts.push(`Színhőmérséklet ${signed(n('colorTempDelta')!)} K`);
  }
  if (typeof command.color === 'string') {
    parts.push(`Szín ${command.color.toLowerCase()}`);
  }
  if (command.scene !== undefined) {
    parts.push(`Jelenet: ${describeScene(command.scene, scenes)}`);
  }
  if (n('speed') !== undefined) parts.push(`Sebesség ${n('speed')}%`);

  if (parts.length === 0) return 'Bekapcsolás';
  return parts.join(' · ');
}

export function describeTarget(entry: CommandLogEntry): string {
  return entry.target === 'all' ? 'Az egész lakás' : entry.targetName;
}
