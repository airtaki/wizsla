import createClient, { type Middleware } from 'openapi-fetch';
import type { components, paths } from './schema';

/** The API's DTOs, generated from its OpenAPI document (`npm run api`). */
export type Schemas = components['schemas'];

export type AccessLevel = Schemas['CurrentApiKeyDto']['level'];

/** A failed API call. `status` is 0 when the API could not be reached. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let apiKey: string | null = null;
let onUnauthorized: (() => void) | null = null;

/** The key sent with every call, unless the call sets its own. */
export function setApiKey(key: string | null): void {
  apiKey = key;
}

/** Called when the API rejects the current key (revoked meanwhile). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

const auth: Middleware = {
  onRequest({ request }) {
    if (apiKey && !request.headers.has('X-API-Key')) {
      request.headers.set('X-API-Key', apiKey);
    }
    return request;
  },
  onResponse({ request, response }) {
    if (
      response.status === 401 &&
      request.headers.get('X-API-Key') === apiKey
    ) {
      onUnauthorized?.();
    }
    return response;
  },
};

/** The API, on the app's own origin (in development through Vite's proxy). */
export const api = createClient<paths>({
  baseUrl: globalThis.location?.origin ?? '',
  // Looked up on every call rather than captured once, so tests can stub it.
  fetch: (request) => globalThis.fetch(request),
});
api.use(auth);

interface Result<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Waits for an API call and returns its data, or throws an {@link ApiError}. */
export async function unwrap<T>(call: Promise<Result<T>>): Promise<T> {
  let result: Result<T>;
  try {
    result = await call;
  } catch {
    throw new ApiError(0, 'The API could not be reached');
  }
  const { data, error, response } = result;
  if (!response.ok) {
    throw new ApiError(response.status, messageOf(error, response));
  }
  return data as T;
}

/** Nest sends `{ message: string | string[] }`; validation errors are lists. */
function messageOf(error: unknown, response: Response): string {
  const message = (error as { message?: unknown } | undefined)?.message;
  if (Array.isArray(message)) return message.join('; ');
  if (typeof message === 'string') return message;
  return response.statusText || `HTTP ${response.status}`;
}

/** A short Hungarian explanation of a failed call, for the user. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Váratlan hiba történt.';
  switch (error.status) {
    case 0:
      return 'A Wizsla nem érhető el. Ugyanazon a Wi-Fi hálózaton vagy?';
    case 401:
      return 'Érvénytelen vagy visszavont kulcs.';
    case 403:
      return 'Ehhez a kulcsodnak nincs jogosultsága.';
    default:
      return error.message;
  }
}
