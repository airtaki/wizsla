import {
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ApiError,
  api,
  describeError,
  type Schemas,
  unwrap,
} from '../api/client';
import { useToast } from '../components/toast';
import { STATE_KEY } from '../lights/queries';

export type Room = Schemas['RoomDto'];
export type Bulb = Schemas['BulbDto'];
export type ApiKey = Schemas['ApiKeyDto'];
export type CommandLogEntry = Schemas['CommandLogDto'];
export type Health = Schemas['HealthStatus'];
export type DiscoveryResult = Schemas['DiscoveryResultDto'];

export const ROOMS_KEY = ['rooms'];
export const BULBS_KEY = ['bulbs'];
export const API_KEYS_KEY = ['api-keys'];
export const COMMANDS_KEY = ['commands'];
export const HEALTH_KEY = ['health'];

/** What an admin change may have touched. */
const AFFECTED: QueryKey[] = [ROOMS_KEY, BULBS_KEY, STATE_KEY, API_KEYS_KEY];

export function useRooms() {
  return useQuery({
    queryKey: ROOMS_KEY,
    queryFn: () => unwrap(api.GET('/rooms')),
  });
}

export function useBulbs() {
  return useQuery({
    queryKey: BULBS_KEY,
    queryFn: () => unwrap(api.GET('/bulbs')),
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: API_KEYS_KEY,
    queryFn: () => unwrap(api.GET('/api-keys')),
  });
}

export const LOG_LIMIT = 200;

export function useCommandLog() {
  return useQuery({
    queryKey: COMMANDS_KEY,
    queryFn: () =>
      unwrap(api.GET('/commands', { params: { query: { limit: LOG_LIMIT } } })),
    refetchInterval: 10_000,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: HEALTH_KEY,
    queryFn: () => unwrap(api.GET('/health')),
    refetchInterval: 10_000,
  });
}

/** The API's admin errors, in Hungarian where they are known. */
export function describeAdminError(error: unknown): string {
  if (!(error instanceof ApiError)) return describeError(error);
  const { status, message } = error;
  if (status === 409 && /slug/.test(message)) {
    return 'Ez az URL-azonosító már foglalt.';
  }
  if (status === 409 && /last active admin key/.test(message)) {
    return 'Az utolsó admin kulcsot nem lehet visszavonni. Előbb hozz létre egy másik admin kulcsot.';
  }
  if (status === 409 && /different bulb/.test(message)) {
    return 'Ezen a címen egy másik izzó válaszol.';
  }
  if (status === 400 && /Cannot derive a slug/.test(message)) {
    return 'Ebből a névből nem képezhető URL-azonosító; adj meg egyet.';
  }
  if (status === 404) return 'Ez már nem létezik. Frissítsd az oldalt.';
  if (status === 504) return 'Az izzó nem válaszolt.';
  return describeError(error);
}

/**
 * An admin change. Afterwards it refreshes rooms, bulbs, keys and state;
 * a failure is shown as a toast. `done` may return a message to show.
 */
export function useAdminMutation<V, R>(
  mutationFn: (variables: V) => Promise<R>,
  { done }: { done?: (result: R, variables: V) => string | void } = {},
) {
  const queryClient = useQueryClient();
  const notify = useToast();
  return useMutation({
    mutationFn,
    onSuccess: (result, variables) => {
      const message = done?.(result, variables);
      if (message) notify(message);
    },
    onError: (error) => notify(describeAdminError(error), 'error'),
    onSettled: () =>
      Promise.all(
        AFFECTED.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  });
}
