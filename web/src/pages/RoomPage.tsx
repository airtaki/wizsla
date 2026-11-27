import { useParams } from 'react-router';
import { describeError } from '../api/client';
import { PowerButton } from '../components/controls';
import { Card, Spinner } from '../components/ui';
import { Page } from '../layout/AppShell';
import { BulbList } from '../lights/BulbList';
import { describeGroup } from '../lights/describe';
import { LightControls } from '../lights/LightControls';
import { groupState } from '../lights/model';
import { useCanControl, useOverview } from '../lights/queries';
import { useLightControl } from '../lights/useLightControl';

const HOME = { to: '/', label: 'Otthon' };

export function RoomPage() {
  const { slug = '' } = useParams();
  const overview = useOverview();
  const control = useLightControl({ kind: 'room', ref: slug });
  const canControl = useCanControl();

  if (overview.isPending) {
    return (
      <Page title="" back={HOME}>
        <Spinner />
      </Page>
    );
  }
  if (overview.isError) {
    return (
      <Page title="Szoba" back={HOME}>
        <Card role="alert">{describeError(overview.error)}</Card>
      </Page>
    );
  }

  const room = overview.data.rooms.find((r) => r.slug === slug);
  if (!room) {
    return (
      <Page title="Nincs ilyen szoba" back={HOME}>
        <Card className="text-zinc-500">
          Ezt a szobát törölték vagy átnevezték.
        </Card>
      </Page>
    );
  }

  const bulbs = room.bulbs.filter((b) => b.enabled);
  const group = groupState(bulbs);
  const on = group.lit > 0;

  return (
    <Page
      title={room.name}
      back={HOME}
      action={
        <PowerButton
          on={on}
          label={`${room.name} ${on ? 'lekapcsolása' : 'felkapcsolása'}`}
          disabled={!canControl || group.reachable === 0}
          onToggle={() => control({ on: !on })}
        />
      }
    >
      <p className="-mt-3 text-sm text-zinc-500">{describeGroup(room.bulbs)}</p>
      {bulbs.length > 0 && <LightControls bulbs={bulbs} control={control} />}
      {room.bulbs.length > 0 ? (
        <section aria-labelledby="bulbs-heading">
          <h2
            id="bulbs-heading"
            className="mb-2 text-sm font-medium text-zinc-500"
          >
            Izzók
          </h2>
          <BulbList bulbs={room.bulbs} />
        </section>
      ) : (
        <Card className="text-zinc-500">Ebben a szobában nincs izzó.</Card>
      )}
    </Page>
  );
}
