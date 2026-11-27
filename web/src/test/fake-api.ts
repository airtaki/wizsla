import { vi } from 'vitest';

export type Handler = (request: Request) => Response | Promise<Response>;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A handler for "METHOD /path"; `:name` in the key matches one segment. */
function findHandler(
  handlers: Record<string, Handler>,
  method: string,
  pathname: string,
): Handler | undefined {
  const exact = handlers[`${method} ${pathname}`];
  if (exact) return exact;
  const segments = pathname.split('/');
  for (const [key, handler] of Object.entries(handlers)) {
    const [keyMethod, keyPath] = key.split(' ');
    const pattern = keyPath.split('/');
    if (
      keyMethod === method &&
      pattern.length === segments.length &&
      pattern.every((p, i) => p.startsWith(':') || p === segments[i])
    ) {
      return handler;
    }
  }
  return undefined;
}

/**
 * Replaces fetch with handlers keyed by "METHOD /path". Unknown calls answer
 * 404. Returns the requests made, for assertions.
 */
export function fakeApi(handlers: Record<string, Handler>): Request[] {
  const requests: Request[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      requests.push(request);
      const { pathname } = new URL(request.url);
      const handler = findHandler(handlers, request.method, pathname);
      return handler
        ? handler(request)
        : json({ message: `No fake for ${pathname}` }, 404);
    }),
  );
  return requests;
}

/** A `/api-keys/me` handler that accepts only `keys`. */
export function keys(
  known: Record<string, { name: string; level: 'read' | 'control' | 'admin' }>,
): Handler {
  return (request) => {
    const me = known[request.headers.get('X-API-Key') ?? ''];
    return me
      ? json({ id: 1, ...me })
      : json({ message: 'Invalid or revoked API key', statusCode: 401 }, 401);
  };
}
