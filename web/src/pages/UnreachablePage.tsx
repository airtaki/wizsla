import { RefreshCw, WifiOff } from 'lucide-react';
import { Button, Card, CenteredScreen } from '../components/ui';
import { useSession } from '../session/session';

export function UnreachablePage({ error }: { error: string }) {
  const { retry, signOut } = useSession();

  return (
    <CenteredScreen>
      <Card className="flex flex-col items-center gap-4 p-6 text-center">
        <WifiOff className="size-10 text-zinc-400" aria-hidden />
        <p role="alert">{error}</p>
        <div className="flex w-full flex-col gap-2">
          <Button onClick={retry}>
            <RefreshCw className="size-4" aria-hidden />
            Újra
          </Button>
          <Button variant="ghost" onClick={() => signOut()}>
            Kijelentkezés
          </Button>
        </div>
      </Card>
    </CenteredScreen>
  );
}
