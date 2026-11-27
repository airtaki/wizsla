import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { LightDots, PowerButton } from '../components/controls';
import { Card } from '../components/ui';
import { lightColor } from './colors';
import { describeBulb } from './describe';
import { type BulbState, isLit, isReachable } from './model';
import { useCanControl } from './queries';
import { useLightControl } from './useLightControl';

export function BulbList({ bulbs }: { bulbs: BulbState[] }) {
  return (
    <Card className="divide-y divide-zinc-100 p-0 dark:divide-zinc-800">
      {bulbs.map((bulb) => (
        <BulbRow key={bulb.id} bulb={bulb} />
      ))}
    </Card>
  );
}

function BulbRow({ bulb }: { bulb: BulbState }) {
  const control = useLightControl({ kind: 'bulb', ref: bulb.slug });
  const canControl = useCanControl();
  const color = isLit(bulb) ? lightColor(bulb.state) : null;
  const lit = isLit(bulb);

  return (
    <div className="flex items-center gap-3 py-2 pr-3 pl-4">
      <Link
        to={`/bulbs/${bulb.slug}`}
        className="flex min-w-0 flex-1 items-center gap-3 py-1"
      >
        <LightDots colors={color ? [color] : []} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{bulb.name}</span>
          <span className="block truncate text-sm text-zinc-500">
            {describeBulb(bulb)}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-zinc-400" aria-hidden />
      </Link>
      <PowerButton
        on={lit}
        label={`${bulb.name} ${lit ? 'kikapcsolása' : 'bekapcsolása'}`}
        disabled={!canControl || !isReachable(bulb)}
        onToggle={() => control({ on: !lit })}
      />
    </div>
  );
}
