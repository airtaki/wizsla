import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { setupWebApp } from '../src/web.js';
import { createTestApp, type TestApp } from './support/app.js';

const INDEX = '<!doctype html><title>Wizsla</title>';
const SCRIPT = 'console.log("wizsla");';

describe('Web app (e2e)', () => {
  let t: TestApp;
  let dir: string;

  const http = () => request(t.app.getHttpServer());

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'wizsla-web-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), INDEX);
    writeFileSync(join(dir, 'assets', 'index-abc123.js'), SCRIPT);
    writeFileSync(join(dir, 'manifest.webmanifest'), '{}');
    t = await createTestApp({ webDir: dir });
  });

  afterAll(async () => {
    await t.app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('sends / to the web app', async () => {
    const res = await http().get('/').expect(302);
    expect(res.headers.location).toBe('/app/');
  });

  it('serves index.html, never cached without a check', async () => {
    const res = await http().get('/app/').expect(200);
    expect(res.text).toBe(INDEX);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('adds the trailing slash to /app', async () => {
    const res = await http().get('/app').expect(301);
    expect(res.headers.location).toBe('/app/');
  });

  it('caches hashed assets for good', async () => {
    const res = await http().get('/app/assets/index-abc123.js').expect(200);
    expect(res.text).toBe(SCRIPT);
    expect(res.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('serves other files with a check', async () => {
    const res = await http().get('/app/manifest.webmanifest').expect(200);
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it("answers the app's own routes with index.html", async () => {
    for (const path of ['/app/rooms', '/app/rooms/nappali']) {
      const res = await http().get(path).expect(200);
      expect(res.text).toBe(INDEX);
    }
  });

  it('answers a missing file with 404', async () => {
    await http().get('/app/assets/missing.js').expect(404);
  });

  it('needs no key for the files, but the API still does', async () => {
    await http().get('/app/').expect(200);
    await http().get('/rooms').expect(401);
    await http().get('/health').expect(200);
  });

  it('serves nothing when the web app is not built', () => {
    const missing = join(dir, 'does-not-exist');
    expect(setupWebApp(t.app, missing)).toBe(false);
  });
});
