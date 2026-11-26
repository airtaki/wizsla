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
  /** `text` for people, `json` (one object per line) for log tools. */
  LOG_FORMAT: z.enum(['text', 'json']).default('text'),
  /** SQLite file, relative to the working directory. Keep the default in sync with prisma.config.ts. */
  DATABASE_URL: z
    .string()
    .startsWith('file:', 'must be a SQLite file URL (file:...)')
    .default('file:./data/wizsla.db'),
  /** Where the daily database backups go, relative to the working directory. */
  BACKUP_DIR: z.string().min(1).default('./data/backups'),
  /** How many daily backups to keep; 0 turns backups off. */
  BACKUP_KEEP: z.coerce.number().int().min(0).max(365).default(14),

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
  /** How often every bulb's state is read in the background; 0 turns it off. */
  WIZ_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .refine((ms) => ms === 0 || (ms >= 5000 && ms <= 600000), {
      message: 'must be 0 (off) or between 5000 and 600000',
    })
    .default(20000),
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
