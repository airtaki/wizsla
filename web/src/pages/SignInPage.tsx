import { KeyRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { describeError } from '../api/client';
import { Button, Card, CenteredScreen, Input } from '../components/ui';
import { useSession } from '../session/session';

export function SignInPage({ notice }: { notice?: string }) {
  const { signIn } = useSession();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(key.trim());
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <CenteredScreen>
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <img
          src={`${import.meta.env.BASE_URL}icon.svg`}
          alt=""
          className="size-16"
        />
        <h1 className="text-2xl font-bold tracking-tight">Wizsla</h1>
      </div>
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor="api-key" className="text-sm font-medium">
            API-kulcs
          </label>
          <Input
            id="api-key"
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="wzs_…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          {(error ?? notice) && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error ?? notice}
            </p>
          )}
          <Button type="submit" disabled={busy || key.trim() === ''}>
            <KeyRound className="size-4" aria-hidden />
            Belépés
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-zinc-500">
        A kulcsot a Wizsla adminisztrátorától kapod.
      </p>
    </CenteredScreen>
  );
}
