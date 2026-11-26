import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

// Every e2e run gets its own throwaway SQLite database. The global setup
// applies the migrations to it; the test workers connect to it.
const databaseFile = join(tmpdir(), `wizsla-e2e-${randomUUID()}.db`);
process.env.WIZSLA_E2E_DATABASE = databaseFile;

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/e2e-database.ts'],
    env: {
      DATABASE_URL: `file:${databaseFile}`,
      LOG_LEVEL: 'error',
    },
  },
});
