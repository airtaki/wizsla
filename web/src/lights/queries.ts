import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '../api/client';
import { useSignedIn } from '../session/session';

export const STATE_KEY = ['state'] as const;
export const SCENES_KEY = ['scenes'] as const;

/** How often the state is read while the app is visible. */
export const STATE_REFRESH_MS = 5_000;

/** Every room and bulb with its last known state, refreshed while visible. */
export function useOverview() {
  return useQuery({
    queryKey: STATE_KEY,
    queryFn: () => unwrap(api.GET('/state')),
    refetchInterval: STATE_REFRESH_MS,
  });
}

/** The scenes the firmware offers; they never change while running. */
export function useScenes() {
  return useQuery({
    queryKey: SCENES_KEY,
    queryFn: () => unwrap(api.GET('/scenes')),
    staleTime: Infinity,
  });
}

/** Whether the signed-in key may switch lights (`control` or `admin`). */
export function useCanControl(): boolean {
  return useSignedIn().level !== 'read';
}
