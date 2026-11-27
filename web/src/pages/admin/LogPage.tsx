import { describeCommand, describeTarget } from '../../admin/describe';
import { EmptyState, Loaded } from '../../admin/components';
import {
  type CommandLogEntry,
  LOG_LIMIT,
  useCommandLog,
} from '../../admin/queries';
import { cn, ListGroup, SectionTitle } from '../../components/ui';
import { formatClock, formatDay } from '../../format';
import type { Scene } from '../../lights/model';
import { useScenes } from '../../lights/queries';

/** Entries by day, newest first, as they come. */
function byDay(entries: CommandLogEntry[]): [string, CommandLogEntry[]][] {
  const days = new Map<string, CommandLogEntry[]>();
  for (const entry of entries) {
    const day = formatDay(entry.createdAt);
    days.set(day, [...(days.get(day) ?? []), entry]);
  }
  return [...days];
}

export function LogPage() {
  const log = useCommandLog();
  const scenes = useScenes().data ?? [];

  return (
    <Loaded title="Parancsnapló" query={log}>
      {(entries) =>
        entries.length === 0 ? (
          <EmptyState>Még nem küldött senki parancsot.</EmptyState>
        ) : (
          <>
            {byDay(entries).map(([day, list]) => (
              <section key={day} aria-label={day}>
                <SectionTitle>{day}</SectionTitle>
                <ListGroup>
                  {list.map((entry) => (
                    <LogRow key={entry.id} entry={entry} scenes={scenes} />
                  ))}
                </ListGroup>
              </section>
            ))}
            <p className="px-1 text-sm text-zinc-500">
              Az utolsó {LOG_LIMIT} parancs; a napló 90 napig őrzi őket.
            </p>
          </>
        )
      }
    </Loaded>
  );
}

function LogRow({
  entry,
  scenes,
}: {
  entry: CommandLogEntry;
  scenes: Scene[];
}) {
  const all = entry.succeeded === entry.bulbs;
  const none = entry.succeeded === 0 && entry.bulbs > 0;
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate font-medium">{describeTarget(entry)}</p>
        <span
          className={cn(
            'shrink-0 text-sm font-medium tabular-nums',
            all
              ? 'text-green-600 dark:text-green-400'
              : none
                ? 'text-red-600 dark:text-red-400'
                : 'text-amber-600 dark:text-amber-400',
          )}
          title={`${entry.succeeded} izzóból ${entry.bulbs} hajtotta végre`}
        >
          {entry.succeeded}/{entry.bulbs}
        </span>
      </div>
      <p className="text-[15px] text-zinc-700 dark:text-zinc-300">
        {describeCommand(entry.command, scenes)}
      </p>
      <p className="text-sm text-zinc-500 tabular-nums">
        {formatClock(entry.createdAt)} · {entry.keyName} · {entry.durationMs} ms
      </p>
    </div>
  );
}
