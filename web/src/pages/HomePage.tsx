import { useQuery } from '@tanstack/react-query';
import { api, describeError, unwrap } from '../api/client';
import { Card, Spinner } from '../components/ui';
import { Page } from '../layout/AppShell';

/** How often the state is read while the page is visible. */
export const STATE_REFRESH_MS = 5_000;

export function HomePage() {
  const state = useQuery({
    queryKey: ['state'],
    queryFn: () => unwrap(api.GET('/state')),
    refetchInterval: STATE_REFRESH_MS,
  });

  return (
    <Page title="Otthon">
      {state.isPending ? (
        <Spinner />
      ) : state.isError ? (
        <Card role="alert">{describeError(state.error)}</Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            label="Elérhető"
            value={`${state.data.summary.online}/${state.data.summary.total}`}
          />
          <Stat label="Ég" value={String(state.data.summary.on)} />
          <Stat
            label="Átlagos fényerő"
            value={
              state.data.summary.brightness === null
                ? '–'
                : `${Math.round(state.data.summary.brightness)}%`
            }
          />
        </div>
      )}
      <p className="text-sm text-zinc-500">
        Hamarosan: szobák, izzók és vezérlés.
      </p>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
