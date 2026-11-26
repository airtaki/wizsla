import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

/** Vitest global setup: migrate the throwaway e2e database, remove it afterwards. */
export default function setup(): () => void {
  const file = process.env.WIZSLA_E2E_DATABASE;
  if (!file) throw new Error('WIZSLA_E2E_DATABASE is not set');

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: {
      ...process.env,
      DATABASE_URL: `file:${file}`,
      CHECKPOINT_DISABLE: '1',
    },
    stdio: 'pipe',
  });

  return () => {
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      rmSync(file + suffix, { force: true });
    }
  };
}
