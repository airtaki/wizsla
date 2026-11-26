import { defineConfig } from 'prisma/config';

// The Prisma CLI does not read .env on its own; Node can.
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment.
}

// No update checks / usage reporting to Prisma's servers (the npm scripts
// set this too, early enough for every command).
process.env.CHECKPOINT_DISABLE ??= '1';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Keep in sync with the default in src/config/env.ts.
    url: process.env.DATABASE_URL ?? 'file:./data/wizsla.db',
  },
});
