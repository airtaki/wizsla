import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedKey } from '../auth/decorators.js';
import { PrismaService } from '../database/prisma.service.js';
import type {
  BulbCommandResultDto,
  CommandLogDto,
  LightCommandDto,
} from './control.dto.js';

/** Log entries older than this are deleted. */
const RETENTION_DAYS = 90;
const PRUNE_EVERY_MS = 24 * 60 * 60_000;

export interface CommandRecord {
  key: AuthenticatedKey | undefined;
  target: 'bulb' | 'room' | 'all';
  targetId: number | null;
  targetName: string;
  command: LightCommandDto;
  results: BulbCommandResultDto[];
  startedAt: number;
}

/** Remembers who sent which command, for the last 90 days. */
@Injectable()
export class CommandLogService {
  private readonly logger = new Logger('Commands');
  private lastPrune = 0;

  constructor(private readonly prisma: PrismaService) {}

  /** Never throws: a failed log write must not fail the command. */
  async record(entry: CommandRecord): Promise<void> {
    const succeeded = entry.results.filter((r) => r.status === 'ok').length;
    const keyName = entry.key?.name ?? 'unknown';
    const command = JSON.stringify(entry.command);
    this.logger.log(
      `${keyName} → ${entry.targetName}: ${command} (${succeeded}/${entry.results.length} ok)`,
    );

    try {
      await this.prisma.commandLog.create({
        data: {
          apiKeyId: entry.key?.id,
          keyName,
          target: entry.target,
          targetId: entry.targetId,
          targetName: entry.targetName,
          command,
          bulbs: entry.results.length,
          succeeded,
          durationMs: Date.now() - entry.startedAt,
        },
      });
      await this.pruneOccasionally();
    } catch (error) {
      this.logger.warn(
        `Could not write the command log: ${(error as Error).message}`,
      );
    }
  }

  async list(limit = 50): Promise<CommandLogDto[]> {
    const rows = await this.prisma.commandLog.findMany({
      orderBy: { id: 'desc' },
      take: limit,
    });
    return rows.map(({ apiKeyId: _id, command, ...row }) => ({
      ...row,
      command: JSON.parse(command) as Record<string, unknown>,
    }));
  }

  private async pruneOccasionally(): Promise<void> {
    const now = Date.now();
    if (now - this.lastPrune < PRUNE_EVERY_MS) return;
    this.lastPrune = now;
    const before = new Date(now - RETENTION_DAYS * 24 * 60 * 60_000);
    await this.prisma.commandLog.deleteMany({
      where: { createdAt: { lt: before } },
    });
  }
}
