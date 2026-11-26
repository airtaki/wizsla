import { existsSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

/** Where the web app is served. */
export const WEB_PATH = '/app';

/** The built web app: `web/dist`, beside `src/` and `dist/`. */
export const WEB_DIST = fileURLToPath(new URL('../web/dist/', import.meta.url));

/** Vite puts content-hashed files here; they never change under one name. */
const HASHED_DIR = `${sep}assets${sep}`;

/**
 * Serves the web app's static files under {@link WEB_PATH} and sends `/`
 * there. The files hold no data and need no API key: the app itself calls
 * the API with the user's key, like any other client.
 *
 * Paths without a file extension get `index.html`, so the app's own routes
 * (`/app/rooms/nappali`) survive a reload; a missing file stays a 404.
 *
 * Returns false, and serves nothing, when the web app is not built.
 */
export function setupWebApp(
  app: NestExpressApplication,
  dir: string = WEB_DIST,
): boolean {
  const root = resolve(dir);
  const index = join(root, 'index.html');
  if (!existsSync(index)) {
    new Logger('WebApp').warn(`Not built (no ${index}); ${WEB_PATH} is off`);
    return false;
  }

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' && req.path === '/') {
      res.redirect(302, `${WEB_PATH}/`);
      return;
    }
    next();
  });

  app.useStaticAssets(root, {
    prefix: WEB_PATH,
    setHeaders(res, path) {
      res.setHeader(
        'Cache-Control',
        path.includes(HASHED_DIR)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
      );
    },
  });

  app.use(WEB_PATH, (req: Request, res: Response, next: NextFunction) => {
    const isRead = req.method === 'GET' || req.method === 'HEAD';
    if (!isRead || extname(req.path) !== '') {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });

  return true;
}
