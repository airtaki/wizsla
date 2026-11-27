import type { ReactNode } from 'react';
import { SETTINGS } from '../../admin/components';
import { type Health, useHealth } from '../../admin/queries';
import { ApiError, describeError } from '../../api/client';
import { Card, cn, Spinner } from '../../components/ui';
import { Page } from '../../layout/AppShell';
import { formatDateTime, formatDuration } from '../../format';

/** A backup older than this is worth a look (they run nightly). */
const STALE_BACKUP_MS = 36 * 3600 * 1000;

export function SystemPage() {
  const health = useHealth();
  // 503: the service answers, but its database does not.
  const down = health.error instanceof ApiError && health.error.status === 503;

  return (
    <Page title="Rendszer" back={SETTINGS}>
      {down ? (
        <Card role="alert">
          A Wizsla fut, de az adatbázisa nem érhető el. Nézd meg a naplót a
          Pi-n: <code>pm2 logs wizsla</code>
        </Card>
      ) : health.isPending ? (
        <Spinner />
      ) : health.isError ? (
        <Card role="alert">{describeError(health.error)}</Card>
      ) : (
        <HealthFacts health={health.data} at={health.dataUpdatedAt} />
      )}
    </Page>
  );
}

/** `at`: when the answer came, to judge the backup's age by. */
function HealthFacts({ health, at }: { health: Health; at: number }) {
  const backupAge = health.lastBackup
    ? at - new Date(health.lastBackup).getTime()
    : null;
  const facts: [string, ReactNode, boolean?][] = [
    [
      'Állapot',
      health.status === 'ok' ? 'Rendben' : 'Hiba',
      health.status === 'ok',
    ],
    [
      'Adatbázis',
      health.database === 'ok' ? 'Rendben' : 'Hiba',
      health.database === 'ok',
    ],
    [
      'Izzók',
      health.bulbs
        ? `${health.bulbs.online}/${health.bulbs.total} elérhető`
        : '–',
      health.bulbs ? health.bulbs.online === health.bulbs.total : undefined,
    ],
    [
      'Utolsó mentés',
      health.lastBackup ? formatDateTime(health.lastBackup) : 'Még nem volt',
      backupAge !== null && backupAge < STALE_BACKUP_MS,
    ],
    ['Futásidő', formatDuration(health.uptime)],
    ['Verzió', health.version],
    ['Node.js', health.node],
  ];

  return (
    <Card>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[15px]">
        {facts.map(([term, value, good]) => (
          <div key={term} className="contents">
            <dt className="text-zinc-500">{term}</dt>
            <dd
              className={cn(
                'flex items-center gap-2',
                good === false && 'text-amber-700 dark:text-amber-400',
              )}
            >
              {good !== undefined && (
                <span
                  aria-hidden
                  className={cn(
                    'size-2 rounded-full',
                    good ? 'bg-green-500' : 'bg-amber-500',
                  )}
                />
              )}
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
