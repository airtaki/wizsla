import { ChevronDown, Gauge } from 'lucide-react';
import { useState } from 'react';
import { describeError } from '../api/client';
import { Slider } from '../components/controls';
import { Card, Spinner } from '../components/ui';
import { Page } from '../layout/AppShell';
import { bulbsOf, groupState, type Target } from '../lights/model';
import { useCanControl, useOverview, useScenes } from '../lights/queries';
import { SceneGrid, scenesFor } from '../lights/SceneGrid';
import { useLightControl } from '../lights/useLightControl';

/** `all`, `room:<slug>` or `bulb:<slug>`, as the picker's value. */
function parseTarget(value: string): Target {
  const [kind, ref = ''] = value.split(':');
  return kind === 'room' || kind === 'bulb' ? { kind, ref } : { kind: 'all' };
}

export function ScenesPage() {
  const overview = useOverview();
  const scenes = useScenes();
  const canControl = useCanControl();
  const [targetValue, setTargetValue] = useState('all');
  const target = parseTarget(targetValue);
  const control = useLightControl(target);

  if (overview.isPending || scenes.isPending) {
    return (
      <Page title="Jelenetek">
        <Spinner />
      </Page>
    );
  }
  if (overview.isError || scenes.isError) {
    return (
      <Page title="Jelenetek">
        <Card role="alert">
          {describeError(overview.error ?? scenes.error)}
        </Card>
      </Page>
    );
  }

  const group = groupState(bulbsOf(overview.data, target));
  const playing =
    group.mode === 'scene'
      ? scenes.data.find((s) => s.id === group.sceneId)
      : undefined;
  const disabled = !canControl || group.reachable === 0;
  const { rooms, unassigned } = overview.data;

  return (
    <Page title="Jelenetek">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-500">Hol?</span>
        <span className="relative">
          <select
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="h-11 w-full appearance-none rounded-xl border border-zinc-300 bg-white pr-10 pl-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="all">Az egész lakás</option>
            {rooms.length > 0 && (
              <optgroup label="Szobák">
                {rooms.map((room) => (
                  <option key={room.id} value={`room:${room.slug}`}>
                    {room.name}
                  </option>
                ))}
              </optgroup>
            )}
            {rooms.map(
              (room) =>
                room.bulbs.length > 0 && (
                  <optgroup key={room.id} label={`Izzók – ${room.name}`}>
                    {room.bulbs.map((bulb) => (
                      <option key={bulb.id} value={`bulb:${bulb.slug}`}>
                        {bulb.name}
                      </option>
                    ))}
                  </optgroup>
                ),
            )}
            {unassigned.length > 0 && (
              <optgroup label="Izzók – szoba nélkül">
                {unassigned.map((bulb) => (
                  <option key={bulb.id} value={`bulb:${bulb.slug}`}>
                    {bulb.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-3 right-3 size-5 text-zinc-400"
            aria-hidden
          />
        </span>
      </label>

      {group.reachable === 0 && (
        <Card className="text-sm text-zinc-500">
          Itt most egy izzó sem érhető el.
        </Card>
      )}

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
        scenes={scenesFor(scenes.data, group.kinds)}
        activeId={group.lit > 0 ? group.sceneId : null}
        disabled={disabled}
        onPick={(scene) => control({ scene: scene.id })}
      />
    </Page>
  );
}
