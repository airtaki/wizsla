import type { LogLevel } from '@nestjs/common';
import { z } from 'zod';

/** Nest log levels, from the most verbose to the most severe. */
const LOG_LEVELS = [
  'verbose',
  'debug',
  'log',
  'warn',
  'error',
  'fatal',
] as const satisfies readonly LogLevel[];

/**
 * Infrastructure settings only. Domain data (rooms, bulbs, API keys) lives in
 * the database and is managed through the API, never through the environment.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('log'),
  /** SQLite file, relative to the working directory. Keep the default in sync with prisma.config.ts. */
  DATABASE_URL: z
    .string()
    .startsWith('file:', 'must be a SQLite file URL (file:...)')
    .default('file:./data/wizsla.db'),

  /** Where discovery broadcasts; a subnet broadcast (e.g. 192.168.11.255) also works. */
  WIZ_BROADCAST_ADDRESS: z.ipv4().default('255.255.255.255'),
  /** UDP port of the bulbs. Only simulators and tests use another one. */
  WIZ_PORT: z.coerce.number().int().min(1).max(65535).default(38899),
  /** How long to wait for a bulb before resending. */
  WIZ_TIMEOUT_MS: z.coerce.number().int().min(10).max(10000).default(1000),
  /** How many times to resend an unanswered request. */
  WIZ_RETRIES: z.coerce.number().int().min(0).max(10).default(2),
  /** How long discovery collects answers. */
  WIZ_DISCOVERY_MS: z.coerce.number().int().min(100).max(30000).default(2000),
});

export type Env = z.infer<typeof envSchema>;

/** Validates the raw environment; used by ConfigModule at startup. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

/** Returns the given level together with every more severe level. */
export function logLevelsFrom(minimum: LogLevel): LogLevel[] {
  return LOG_LEVELS.slice(LOG_LEVELS.indexOf(minimum));
}
