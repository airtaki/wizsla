import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// Every e2e run gets its own throwaway SQLite database. The global setup
// applies the migrations to it; the test workers connect to it.
const databaseFile = join(tmpdir(), `wizsla-e2e-${randomUUID()}.db`);
process.env.WIZSLA_E2E_DATABASE = databaseFile;

// Discovery "broadcasts" to a simulated bulb on loopback at this port.
const wizPort = 40000 + Math.floor(Math.random() * 20000);

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/e2e-database.ts'],
    // The spec files share one database and one bulb port.
    fileParallelism: false,
    env: {
      DATABASE_URL: `file:${databaseFile}`,
      LOG_LEVEL: 'error',
      WIZ_BROADCAST_ADDRESS: '127.0.0.1',
      WIZ_PORT: String(wizPort),
      WIZ_TIMEOUT_MS: '100',
      WIZ_RETRIES: '1',
      WIZ_DISCOVERY_MS: '300',
    },
  },
});
