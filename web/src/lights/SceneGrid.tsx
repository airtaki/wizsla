import { Check } from 'lucide-react';
import { cn } from '../components/ui';
import { sceneGradient, sceneName } from './colors';
import type { Scene } from './model';

/** Scenes the given bulb kinds can play; all of them when none is known. */
export function scenesFor(scenes: Scene[], kinds: string[]): Scene[] {
  if (kinds.length === 0) return scenes;
  return scenes.filter((scene) =>
    scene.supportedKinds.some((kind) => kinds.includes(kind)),
  );
}

export function SceneGrid({
  scenes,
  activeId,
  disabled,
  onPick,
}: {
  scenes: Scene[];
  activeId: number | null;
  disabled?: boolean;
  onPick: (scene: Scene) => void;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {scenes.map((scene) => {
        const active = scene.id === activeId;
        return (
          <li key={scene.id}>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onPick(scene)}
              style={{ backgroundImage: sceneGradient(scene.id) }}
              className={cn(
                'relative flex aspect-[4/3] w-full items-end overflow-hidden rounded-xl p-2 text-left',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
                'disabled:opacity-50',
                active &&
                  'ring-3 ring-amber-500 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-950',
              )}
            >
              <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <span className="relative text-[13px] leading-tight font-semibold text-white">
                {sceneName(scene)}
              </span>
              {active && (
                <Check
                  className="absolute top-1.5 right-1.5 size-5 rounded-full bg-white p-0.5 text-amber-600"
                  aria-hidden
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
