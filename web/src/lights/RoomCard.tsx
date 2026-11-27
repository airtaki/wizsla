import { Sun } from 'lucide-react';
import { Link } from 'react-router';
import { LightDots, PowerButton, Slider } from '../components/controls';
import { Card } from '../components/ui';
import { litColors } from './colors';
import { describeGroup } from './describe';
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  groupState,
  type RoomState,
} from './model';
import { useCanControl } from './queries';
import { useLightControl } from './useLightControl';

export function RoomCard({ room }: { room: RoomState }) {
  const control = useLightControl({ kind: 'room', ref: room.slug });
  const canControl = useCanControl();
  const bulbs = room.bulbs.filter((b) => b.enabled);
  const group = groupState(bulbs);
  const on = group.lit > 0;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Link to={`/rooms/${room.slug}`} className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-lg font-semibold">{room.name}</span>
            <LightDots colors={litColors(bulbs)} />
          </span>
          <span className="block text-sm text-zinc-500">
            {describeGroup(room.bulbs)}
          </span>
        </Link>
        <PowerButton
          on={on}
          label={`${room.name} ${on ? 'lekapcsolása' : 'felkapcsolása'}`}
          disabled={!canControl || group.reachable === 0}
          onToggle={() => control({ on: !on })}
        />
      </div>
      {on && canControl && (
        <Slider
          label="Fényerő"
          icon={<Sun className="size-4" aria-hidden />}
          value={group.brightness ?? BRIGHTNESS_MAX}
          min={BRIGHTNESS_MIN}
          max={BRIGHTNESS_MAX}
          format={(v) => `${v}%`}
          onChange={(brightness) => control({ brightness })}
        />
      )}
    </Card>
  );
}
