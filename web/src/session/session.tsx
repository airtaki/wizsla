import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  type AccessLevel,
  ApiError,
  api,
  describeError,
  setApiKey,
  setUnauthorizedHandler,
  unwrap,
} from '../api/client';
import {
  clearStoredKey,
  keyFromLink,
  readStoredKey,
  removeKeyFromLink,
  storeKey,
} from './key-storage';

export interface Session {
  id: number;
  name: string;
  level: AccessLevel;
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut'; notice?: string }
  | { status: 'signedIn'; session: Session }
  /** A key is stored, but the API cannot be reached to check it. */
  | { status: 'unreachable'; key: string; error: string };

interface SessionContextValue {
  state: SessionState;
  /** Checks the key with the API and remembers it. Throws an {@link ApiError}. */
  signIn: (key: string) => Promise<void>;
  signOut: (notice?: string) => void;
  /** Checks the stored key again (after the API was unreachable). */
  retry: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

async function whoIs(key: string): Promise<Session> {
  const me = await unwrap(
    api.GET('/api-keys/me', { headers: { 'X-API-Key': key } }),
  );
  return { id: me.id, name: me.name, level: me.level };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // A key from a sign-in link wins over the stored one.
  const [startKey] = useState(() => keyFromLink() ?? readStoredKey());
  const [state, setState] = useState<SessionState>(
    startKey ? { status: 'loading' } : { status: 'signedOut' },
  );

  const signOut = useCallback(
    (notice?: string) => {
      clearStoredKey();
      setApiKey(null);
      queryClient.clear();
      setState({ status: 'signedOut', notice });
    },
    [queryClient],
  );

  const signIn = useCallback(async (key: string) => {
    const session = await whoIs(key);
    storeKey(key);
    setApiKey(key);
    setState({ status: 'signedIn', session });
  }, []);

  const check = useCallback(
    async (key: string) => {
      try {
        await signIn(key);
      } catch (error) {
        if (error instanceof ApiError && error.status === 0) {
          setState({ status: 'unreachable', key, error: describeError(error) });
        } else {
          signOut('A mentett kulcs már nem érvényes. Lépj be újra.');
        }
      }
    },
    [signIn, signOut],
  );

  useEffect(() => {
    removeKeyFromLink();
    // check() sets state only after awaiting the API, never synchronously.
    // oxlint-disable-next-line react/set-state-in-effect
    if (startKey) void check(startKey);
  }, [startKey, check]);

  useEffect(() => {
    setUnauthorizedHandler(() =>
      signOut('A kulcsodat visszavonták. Lépj be újra.'),
    );
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      signIn,
      signOut,
      retry: () => {
        if (state.status !== 'unreachable') return;
        setState({ status: 'loading' });
        void check(state.key);
      },
    }),
    [state, signIn, signOut, check],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession() outside <SessionProvider>');
  return value;
}

/** The signed-in key. Only for components shown after sign-in. */
export function useSignedIn(): Session {
  const { state } = useSession();
  if (state.status !== 'signedIn') throw new Error('Not signed in');
  return state.session;
}
