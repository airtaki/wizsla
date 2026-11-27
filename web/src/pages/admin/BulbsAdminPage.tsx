import { ChevronRight, Radar, X, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { KIND_LABELS } from '../../admin/describe';
import { EmptyState, Loaded } from '../../admin/components';
import {
  type Bulb,
  type DiscoveryResult,
  type Room,
  useAdminMutation,
  useBulbs,
  useRooms,
} from '../../admin/queries';
import { api, unwrap } from '../../api/client';
import {
  Button,
  Card,
  cn,
  ListGroup,
  SectionTitle,
  Select,
} from '../../components/ui';
import { allBulbs } from '../../lights/model';
import { useOverview } from '../../lights/queries';

/** Online flags from the state poll, by bulb id. */
function useOnline(): Map<number, boolean | null> {
  const overview = useOverview();
  return new Map(
    overview.data ? allBulbs(overview.data).map((b) => [b.id, b.online]) : [],
  );
}

export function useIdentify() {
  return useAdminMutation(
    (bulb: Bulb) =>
      unwrap(
        api.POST('/bulbs/{ref}/identify', {
          params: { path: { ref: bulb.slug } },
        }),
      ),
    { done: (_, bulb) => `„${bulb.name}” villog.` },
  );
}

export function BulbsAdminPage() {
  const bulbs = useBulbs();
  const rooms = useRooms();
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const scan = useAdminMutation(() => unwrap(api.POST('/discovery/scan')), {
    done: (found) => setResult(found),
  });

  return (
    <Loaded
      title="Izzók"
      query={bulbs}
      action={
        <Button
          disabled={scan.isPending}
          onClick={() => scan.mutate(undefined)}
        >
          <Radar
            className={cn('size-4', scan.isPending && 'animate-pulse')}
            aria-hidden
          />
          {scan.isPending ? 'Keresés…' : 'Felderítés'}
        </Button>
      }
    >
      {(list) => (
        <>
          {result && (
            <DiscoverySummary result={result} onClose={() => setResult(null)} />
          )}
          <BulbSections
            bulbs={list}
            rooms={rooms.data ?? []}
            fresh={
              new Set(
                result?.bulbs
                  .filter((d) => d.status === 'new')
                  .map((d) => d.bulb.id),
              )
            }
          />
        </>
      )}
    </Loaded>
  );
}

function DiscoverySummary({
  result,
  onClose,
}: {
  result: DiscoveryResult;
  onClose: () => void;
}) {
  const count = (status: string) =>
    result.bulbs.filter((d) => d.status === status).length;
  const lines = [
    count('new') > 0 && `${count('new')} új izzó, szoba nélkül`,
    count('moved') > 0 && `${count('moved')} izzónak új IP-címe lett`,
    count('known') > 0 && `${count('known')} ismert izzó, változatlan`,
  ].filter(Boolean);

  return (
    <Card aria-live="polite" className="relative flex flex-col gap-2 pr-12">
      <p className="font-medium">
        {result.bulbs.length === 0
          ? 'Nem válaszolt egy izzó sem.'
          : `${result.bulbs.length} izzó válaszolt`}
      </p>
      {lines.length > 0 && (
        <ul className="text-[15px] text-zinc-600 dark:text-zinc-300">
          {lines.map((line) => (
            <li key={String(line)}>{line}</li>
          ))}
        </ul>
      )}
      {result.missing.length > 0 && (
        <p className="text-[15px] text-amber-700 dark:text-amber-400">
          Nem válaszolt: {result.missing.map((b) => b.name).join(', ')}. Talán a
          villanykapcsolónál le van kapcsolva.
        </p>
      )}
      {result.failed.length > 0 && (
        <p className="text-[15px] text-red-600 dark:text-red-400">
          Nem sikerült felvenni: {result.failed.map((f) => f.ip).join(', ')}.
        </p>
      )}
      <button
        type="button"
        aria-label="Eredmény bezárása"
        onClick={onClose}
        className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <X className="size-5" aria-hidden />
      </button>
    </Card>
  );
}

function BulbSections({
  bulbs,
  rooms,
  fresh,
}: {
  bulbs: Bulb[];
  rooms: Room[];
  fresh: Set<number>;
}) {
  const online = useOnline();
  if (bulbs.length === 0) {
    return (
      <EmptyState>
        Még nincs izzó. A Felderítés megkeresi a hálózaton lévőket.
      </EmptyState>
    );
  }

  const unassigned = bulbs.filter((b) => b.room === null);
  return (
    <>
      {unassigned.length > 0 && (
        <section aria-labelledby="unassigned-heading">
          <SectionTitle id="unassigned-heading">Szoba nélkül</SectionTitle>
          <ListGroup>
            {unassigned.map((bulb) => (
              <UnassignedRow
                key={bulb.id}
                bulb={bulb}
                rooms={rooms}
                online={online.get(bulb.id) ?? null}
                fresh={fresh.has(bulb.id)}
              />
            ))}
          </ListGroup>
        </section>
      )}
      {rooms.map((room) => {
        const inRoom = bulbs.filter((b) => b.room?.id === room.id);
        if (inRoom.length === 0) return null;
        const id = `room-${room.id}-heading`;
        return (
          <section key={room.id} aria-labelledby={id}>
            <SectionTitle id={id}>{room.name}</SectionTitle>
            <ListGroup>
              {inRoom.map((bulb) => (
                <BulbLink
                  key={bulb.id}
                  bulb={bulb}
                  online={online.get(bulb.id) ?? null}
                />
              ))}
            </ListGroup>
          </section>
        );
      })}
    </>
  );
}

function StatusDot({ bulb, online }: { bulb: Bulb; online: boolean | null }) {
  const label = !bulb.enabled
    ? 'letiltva'
    : online === true
      ? 'elérhető'
      : online === false
        ? 'nem elérhető'
        : 'ismeretlen';
  return (
    <span
      title={label}
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        !bulb.enabled
          ? 'bg-zinc-300 dark:bg-zinc-600'
          : online
            ? 'bg-green-500'
            : online === false
              ? 'bg-red-500'
              : 'bg-zinc-400',
      )}
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}

function BulbMeta({ bulb, online }: { bulb: Bulb; online: boolean | null }) {
  return (
    <span className="flex items-center gap-1.5 truncate text-sm text-zinc-500">
      <StatusDot bulb={bulb} online={online} />
      {bulb.enabled ? KIND_LABELS[bulb.kind] : 'Letiltva'} · {bulb.ip}
    </span>
  );
}

function BulbLink({ bulb, online }: { bulb: Bulb; online: boolean | null }) {
  return (
    <Link
      to={`/settings/bulbs/${bulb.slug}`}
      className={cn(
        'flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60',
        !bulb.enabled && 'opacity-60',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{bulb.name}</span>
        <BulbMeta bulb={bulb} online={online} />
      </span>
      <ChevronRight className="size-5 text-zinc-400" aria-hidden />
    </Link>
  );
}

/** A bulb waiting for a room: blink it to find it, then pick its room. */
function UnassignedRow({
  bulb,
  rooms,
  online,
  fresh,
}: {
  bulb: Bulb;
  rooms: Room[];
  online: boolean | null;
  fresh: boolean;
}) {
  const identify = useIdentify();
  const assign = useAdminMutation(
    (roomId: number) =>
      unwrap(
        api.PATCH('/bulbs/{ref}', {
          params: { path: { ref: bulb.slug } },
          body: { roomId },
        }),
      ),
    {
      done: (_, roomId) =>
        `„${bulb.name}” → ${rooms.find((r) => r.id === roomId)?.name ?? ''}`,
    },
  );

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <Link
          to={`/settings/bulbs/${bulb.slug}`}
          className="min-w-0 flex-1 hover:opacity-80"
        >
          <span className="flex items-center gap-2 font-medium">
            <span className="truncate">{bulb.name}</span>
            {fresh && (
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                Új
              </span>
            )}
          </span>
          <BulbMeta bulb={bulb} online={online} />
        </Link>
        <Button
          variant="secondary"
          className="h-10 shrink-0 px-3"
          disabled={!bulb.enabled || identify.isPending}
          onClick={() => identify.mutate(bulb)}
        >
          <Zap className="size-4" aria-hidden />
          Azonosít
        </Button>
      </div>
      {rooms.length > 0 && (
        <Select
          aria-label={`${bulb.name} szobája`}
          value=""
          disabled={assign.isPending}
          onChange={(e) => assign.mutate(Number(e.target.value))}
        >
          <option value="" disabled>
            Szobába tesz…
          </option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
