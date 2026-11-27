import { Gauge, Sun, Thermometer } from 'lucide-react';
import { useState } from 'react';
import { Segmented, Slider } from '../components/controls';
import { Card, cn } from '../components/ui';
import { kelvinToHex, sceneName, SWATCHES } from './colors';
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  type BulbState,
  type GroupState,
  groupState,
  type LightCommand,
} from './model';
import { useCanControl, useScenes } from './queries';
import { SceneGrid, scenesFor } from './SceneGrid';

type Tab = 'white' | 'color' | 'scene';

const WHITE_PRESETS = [
  { label: 'Meleg', kelvin: 2700 },
  { label: 'Semleges', kelvin: 4000 },
  { label: 'Hideg', kelvin: 6500 },
];

function initialTab(group: GroupState): Tab {
  if (group.mode === 'color' && group.canColor) return 'color';
  if (group.mode === 'scene') return 'scene';
  return 'white';
}

/**
 * Brightness, white, colour and scenes for a room or a bulb. `control` comes
 * from the page, so the page's power button shares its command queue.
 */
export function LightControls({
  bulbs,
  control,
}: {
  bulbs: BulbState[];
  control: (command: LightCommand) => void;
}) {
  const canControl = useCanControl();
  const scenes = useScenes().data ?? [];
  const group = groupState(bulbs);
  const [chosenTab, setTab] = useState<Tab | null>(null);
  const tab =
    chosenTab === 'color' && !group.canColor
      ? 'white'
      : (chosenTab ?? initialTab(group));

  const disabled = !canControl || group.reachable === 0;
  const playing =
    group.mode === 'scene'
      ? scenes.find((s) => s.id === group.sceneId)
      : undefined;
  const dimmable = !playing || playing.dimmable;

  const tabs: { value: Tab; label: string }[] = [
    { value: 'white', label: 'Fehér' },
    ...(group.canColor ? [{ value: 'color' as const, label: 'Színes' }] : []),
    { value: 'scene', label: 'Jelenet' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Slider
        label="Fényerő"
        icon={<Sun className="size-4" aria-hidden />}
        value={group.brightness ?? BRIGHTNESS_MAX}
        min={BRIGHTNESS_MIN}
        max={BRIGHTNESS_MAX}
        format={(v) => `${v}%`}
        disabled={disabled || !dimmable}
        onChange={(brightness) => control({ brightness })}
      />
      {playing && !playing.dimmable && (
        <p className="-mt-2 text-sm text-zinc-500">
          A(z) „{sceneName(playing)}” jelenet fényereje nem állítható.
        </p>
      )}

      <Segmented
        label="Fény típusa"
        options={tabs}
        value={tab}
        onChange={setTab}
      />

      {tab === 'white' &&
        (group.kelvin ? (
          <WhiteControls
            group={group}
            disabled={disabled}
            onKelvin={(colorTemp) => control({ colorTemp })}
          />
        ) : (
          <Card className="text-sm text-zinc-500">
            Ezeknek az izzóknak nem állítható a színhőmérséklete.
          </Card>
        ))}

      {tab === 'color' && (
        <ColorControls
          current={group.mode === 'color' ? group.color : null}
          disabled={disabled}
          onColor={(color) => control({ color })}
        />
      )}

      {tab === 'scene' && (
        <>
          {playing?.speedAdjustable && (
            <Slider
              label="Sebesség"
              icon={<Gauge className="size-4" aria-hidden />}
              value={group.speed ?? 100}
              min={10}
              max={200}
              step={5}
              format={(v) => `${v}%`}
              disabled={disabled}
              onChange={(speed) => control({ speed })}
            />
          )}
          <SceneGrid
            scenes={scenesFor(scenes, group.kinds)}
            activeId={group.lit > 0 ? group.sceneId : null}
            disabled={disabled}
            onPick={(scene) => control({ scene: scene.id })}
          />
        </>
      )}
    </div>
  );
}

function WhiteControls({
  group,
  disabled,
  onKelvin,
}: {
  group: GroupState;
  disabled: boolean;
  onKelvin: (kelvin: number) => void;
}) {
  const { min, max } = group.kelvin!;
  const presets = WHITE_PRESETS.map((p) => ({
    ...p,
    kelvin: Math.min(max, Math.max(min, p.kelvin)),
  }));

  return (
    <>
      <Slider
        label="Színhőmérséklet"
        icon={<Thermometer className="size-4" aria-hidden />}
        variant="thumb"
        value={group.colorTemp ?? Math.round((min + max) / 200) * 100}
        min={min}
        max={max}
        step={100}
        format={(v) => `${v} K`}
        disabled={disabled}
        trackStyle={{
          background: `linear-gradient(90deg, ${kelvinToHex(min)}, ${kelvinToHex(4500)}, ${kelvinToHex(max)})`,
        }}
        onChange={onKelvin}
      />
      <div className="grid grid-cols-3 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={disabled}
            onClick={() => onKelvin(preset.kelvin)}
            className={cn(
              'flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium',
              'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
              'disabled:opacity-50',
              group.mode === 'white' &&
                group.colorTemp === preset.kelvin &&
                'border-amber-500 dark:border-amber-500',
            )}
          >
            <span
              className="size-3 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: kelvinToHex(preset.kelvin) }}
            />
            {preset.label}
          </button>
        ))}
      </div>
    </>
  );
}

function ColorControls({
  current,
  disabled,
  onColor,
}: {
  current: string | null;
  disabled: boolean;
  onColor: (color: string) => void;
}) {
  return (
    <div className="grid grid-cols-6 gap-3">
      {SWATCHES.map((swatch) => (
        <button
          key={swatch}
          type="button"
          aria-label={`Szín ${swatch}`}
          aria-pressed={current === swatch}
          disabled={disabled}
          onClick={() => onColor(swatch)}
          style={{ backgroundColor: swatch }}
          className={cn(
            'aspect-square rounded-full disabled:opacity-50',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
            current === swatch &&
              'ring-3 ring-zinc-900 ring-offset-2 ring-offset-zinc-50 dark:ring-white dark:ring-offset-zinc-950',
          )}
        />
      ))}
      <label
        className={cn(
          'relative aspect-square cursor-pointer overflow-hidden rounded-full',
          'bg-[conic-gradient(#ff3b30,#ffcc00,#34c759,#00c7be,#007aff,#af52de,#ff3b30)]',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <span className="sr-only">Egyéni szín</span>
        <input
          type="color"
          disabled={disabled}
          value={current ?? '#ffffff'}
          onChange={(e) => onColor(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
