import { LogOut } from 'lucide-react';
import { Button, Card } from '../components/ui';
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
          <Card className="text-zinc-500">
            Hamarosan: szobák, izzók, API-kulcsok, parancsnapló.
          </Card>
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
