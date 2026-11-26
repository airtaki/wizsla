/**
 * Administration from the command line, e.g. creating the first admin key
 * before any key exists. Run after a build, from the project directory:
 *
 *   npm run cli -- apikey:create --name "Admin" --level admin
 *   npm run cli -- apikey:list
 *   npm run cli -- apikey:revoke <id>
 */
import { parseArgs } from 'node:util';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ACCESS_LEVELS, isAccessLevel } from '../auth/access-level.js';
import { ApiKeysService } from '../auth/api-keys.service.js';
import { CoreModule } from '../core.module.js';

@Module({
  imports: [CoreModule],
  providers: [ApiKeysService],
})
class CliModule {}

const USAGE = `Usage:
  npm run cli -- apikey:create --name <name> --level <${ACCESS_LEVELS.join('|')}>
  npm run cli -- apikey:list
  npm run cli -- apikey:revoke <id>`;

async function main(argv: string[]): Promise<void> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      name: { type: 'string' },
      level: { type: 'string' },
    },
  });
  const [command, arg] = positionals;

  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['error', 'warn'],
  });
  const apiKeys = app.get(ApiKeysService);

  try {
    switch (command) {
      case 'apikey:create': {
        const { name, level } = values;
        if (!name || !isAccessLevel(level)) {
          throw new UsageError(
            'apikey:create needs --name and a valid --level',
          );
        }
        const { apiKey, key } = await apiKeys.create(name, level);
        console.log(
          `Created key #${apiKey.id} "${apiKey.name}" (${apiKey.level}).`,
        );
        console.log('\nStore it now, it will not be shown again:\n');
        console.log(`  ${key}\n`);
        break;
      }

      case 'apikey:list': {
        const keys = await apiKeys.list();
        if (keys.length === 0) console.log('No API keys yet.');
        for (const k of keys) {
          const status = k.revokedAt ? 'revoked' : 'active';
          const used = k.lastUsedAt?.toISOString() ?? 'never used';
          console.log(
            `#${String(k.id).padEnd(4)} ${k.prefix}…  ${k.level.padEnd(8)} ${status.padEnd(8)} ${used.padEnd(25)} ${k.name}`,
          );
        }
        break;
      }

      case 'apikey:revoke': {
        const id = Number(arg);
        if (!Number.isInteger(id)) {
          throw new UsageError('apikey:revoke needs a numeric id');
        }
        const revoked = await apiKeys.revoke(id);
        console.log(`Key #${revoked.id} "${revoked.name}" is revoked.`);
        break;
      }

      default:
        throw new UsageError(
          command ? `Unknown command "${command}"` : 'No command given',
        );
    }
  } finally {
    await app.close();
  }
}

class UsageError extends Error {}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(`Error: ${(error as Error).message}`);
  if (error instanceof UsageError) console.error(`\n${USAGE}`);
  process.exitCode = 1;
}
