import { Power } from 'lucide-react';
import { describeError } from '../api/client';
import { Button, Card, Spinner } from '../components/ui';
import { Page } from '../layout/AppShell';
import { BulbList } from '../lights/BulbList';
import { useCanControl, useOverview } from '../lights/queries';
import { RoomCard } from '../lights/RoomCard';
import { useLightControl } from '../lights/useLightControl';
import { useSignedIn } from '../session/session';

export function HomePage() {
  const overview = useOverview();
  const all = useLightControl({ kind: 'all' });
  const canControl = useCanControl();
  const session = useSignedIn();

  if (overview.isPending) {
    return (
      <Page title="Otthon">
        <Spinner />
      </Page>
    );
  }
  if (overview.isError) {
    return (
      <Page title="Otthon">
        <Card role="alert">{describeError(overview.error)}</Card>
      </Page>
    );
  }

  const { summary, rooms, unassigned } = overview.data;
  const anyOn = summary.on > 0;

  return (
    <Page
      title="Otthon"
      action={
        canControl &&
        anyOn && (
          <Button variant="secondary" onClick={() => all({ on: false })}>
            <Power className="size-4" aria-hidden />
            Minden ki
          </Button>
        )
      }
    >
      <p className="-mt-3 text-sm text-zinc-500">
        {anyOn ? `${summary.on} izzó ég` : 'Minden lámpa le van kapcsolva'} ·{' '}
        {summary.online}/{summary.total} elérhető
      </p>

      {rooms.length === 0 ? (
        <Card className="text-zinc-500">
          Még nincs szoba.
          {session.level === 'admin'
            ? ' A szobákat a Beállítások alatt lehet majd felvenni.'
            : ''}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}

      {unassigned.length > 0 && (
        <section aria-labelledby="unassigned-heading">
          <h2
            id="unassigned-heading"
            className="mb-2 text-sm font-medium text-zinc-500"
          >
            Szoba nélkül
          </h2>
          <BulbList bulbs={unassigned} />
        </section>
      )}
    </Page>
  );
}
