import {
  Activity,
  DoorOpen,
  KeyRound,
  Lightbulb,
  LogOut,
  ScrollText,
} from 'lucide-react';
import { MenuRow } from '../admin/components';
import { useApiKeys, useBulbs, useRooms } from '../admin/queries';
import { Button, Card, ListGroup } from '../components/ui';
import { Page } from '../layout/AppShell';
import { LEVEL_LABELS } from '../session/levels';
import { useSession, useSignedIn } from '../session/session';

export function SettingsPage() {
  const { signOut } = useSession();
  const session = useSignedIn();

  return (
    <Page title="Beállítások">
      {session.level === 'admin' && (
        <section aria-labelledby="admin-heading">
          <h2
            id="admin-heading"
            className="mb-2 text-sm font-medium text-zinc-500"
          >
            Adminisztráció
          </h2>
          <AdminMenu />
        </section>
      )}

      <section aria-labelledby="account-heading">
        <h2
          id="account-heading"
          className="mb-2 text-sm font-medium text-zinc-500"
        >
          Fiók
        </h2>
        <Card className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">{session.name}</p>
            <p className="text-sm text-zinc-500">
              Jogosultság: {LEVEL_LABELS[session.level]}
            </p>
          </div>
          <Button variant="secondary" onClick={() => signOut()}>
            <LogOut className="size-4" aria-hidden />
            Kijelentkezés
          </Button>
        </Card>
      </section>
    </Page>
  );
}

function AdminMenu() {
  const rooms = useRooms();
  const bulbs = useBulbs();
  const keys = useApiKeys();
  const unassigned = bulbs.data?.filter((b) => b.room === null).length ?? 0;

  return (
    <ListGroup>
      <MenuRow
        to="/settings/rooms"
        icon={DoorOpen}
        tint="bg-orange-500"
        label="Szobák"
        detail={rooms.data?.length}
      />
      <MenuRow
        to="/settings/bulbs"
        icon={Lightbulb}
        tint="bg-amber-500"
        label="Izzók"
        detail={
          unassigned > 0 ? `${unassigned} szoba nélkül` : bulbs.data?.length
        }
      />
      <MenuRow
        to="/settings/keys"
        icon={KeyRound}
        tint="bg-sky-500"
        label="API-kulcsok"
        detail={keys.data?.filter((k) => !k.revokedAt).length}
      />
      <MenuRow
        to="/settings/log"
        icon={ScrollText}
        tint="bg-violet-500"
        label="Parancsnapló"
      />
      <MenuRow
        to="/settings/system"
        icon={Activity}
        tint="bg-green-600"
        label="Rendszer"
      />
    </ListGroup>
  );
}
