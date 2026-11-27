import { useParams } from 'react-router';
import { describeError } from '../api/client';
import { PowerButton } from '../components/controls';
import { Card, Spinner } from '../components/ui';
import { Page } from '../layout/AppShell';
import { describeBulb, signalLabel } from '../lights/describe';
import { LightControls } from '../lights/LightControls';
import { allBulbs, isLit, isReachable } from '../lights/model';
import { useCanControl, useOverview } from '../lights/queries';
import { formatDateTime } from '../format';
import { useLightControl } from '../lights/useLightControl';

const HOME = { to: '/', label: 'Otthon' };

export function BulbPage() {
  const { slug = '' } = useParams();
  const overview = useOverview();
  const control = useLightControl({ kind: 'bulb', ref: slug });
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
      <Page title="Izzó" back={HOME}>
        <Card role="alert">{describeError(overview.error)}</Card>
      </Page>
    );
  }

  const bulb = allBulbs(overview.data).find((b) => b.slug === slug);
  if (!bulb) {
    return (
      <Page title="Nincs ilyen izzó" back={HOME}>
        <Card className="text-zinc-500">
          Ezt az izzót törölték vagy átnevezték.
        </Card>
      </Page>
    );
  }

  const back = bulb.room
    ? { to: `/rooms/${bulb.room.slug}`, label: bulb.room.name }
    : HOME;
  const lit = isLit(bulb);
  const rssi = bulb.state?.rssi;

  return (
    <Page
      title={bulb.name}
      back={back}
      action={
        <PowerButton
          on={lit}
          label={`${bulb.name} ${lit ? 'kikapcsolása' : 'bekapcsolása'}`}
          disabled={!canControl || !isReachable(bulb)}
          onToggle={() => control({ on: !lit })}
        />
      }
    >
      <p className="-mt-3 text-sm text-zinc-500">{describeBulb(bulb)}</p>

      {!bulb.enabled && (
        <Card className="text-sm text-zinc-500">
          Ez az izzó le van tiltva: a Wizsla nem kérdezi le és nem vezérli.
        </Card>
      )}
      {bulb.enabled && bulb.online === false && (
        <Card className="text-sm">
          Az izzó nem válaszol. Áram van rajta? Ha a fali kapcsoló le van
          kapcsolva, ez rendben van.
        </Card>
      )}

      {bulb.enabled && <LightControls bulbs={[bulb]} control={control} />}

      <Card>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {rssi !== undefined && (
            <>
              <dt className="text-zinc-500">Wi-Fi jel</dt>
              <dd>
                {signalLabel(rssi)} ({rssi} dBm)
              </dd>
            </>
          )}
          <dt className="text-zinc-500">Utoljára válaszolt</dt>
          <dd>{bulb.stateAt ? formatDateTime(bulb.stateAt) : '–'}</dd>
        </dl>
      </Card>
    </Page>
  );
}
