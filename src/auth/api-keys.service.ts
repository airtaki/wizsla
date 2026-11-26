import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { ApiKey } from '../generated/prisma/client.js';
import { type AccessLevel, isAccessLevel } from './access-level.js';
import { generateApiKey, hashApiKey, looksLikeApiKey } from './api-key.util.js';
import type { AuthenticatedKey } from './decorators.js';

/** An API key as shown in listings: everything except the hash. */
export interface ApiKeyView {
  id: number;
  name: string;
  prefix: string;
  level: AccessLevel;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

/** `lastUsedAt` is refreshed at most this often, to avoid a write per request. */
const LAST_USED_RESOLUTION_MS = 60_000;

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Creates a key. The returned `key` is the only time it is available. */
  async create(
    name: string,
    level: AccessLevel,
  ): Promise<{ apiKey: ApiKeyView; key: string }> {
    const generated = generateApiKey();
    const record = await this.prisma.apiKey.create({
      data: {
        name,
        level,
        prefix: generated.prefix,
        hash: generated.hash,
      },
    });
    return { apiKey: toView(record), key: generated.key };
  }

  async list(): Promise<ApiKeyView[]> {
    const records = await this.prisma.apiKey.findMany({
      orderBy: { id: 'asc' },
    });
    return records.map(toView);
  }

  /** Revokes a key. Refuses to revoke the last active admin key. */
  async revoke(id: number): Promise<ApiKeyView> {
    const record = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`API key ${id} not found`);
    if (record.revokedAt) return toView(record);

    if (record.level === 'admin') {
      const activeAdmins = await this.prisma.apiKey.count({
        where: { level: 'admin', revokedAt: null },
      });
      if (activeAdmins <= 1) {
        throw new ConflictException(
          'Cannot revoke the last active admin key; create another admin key first',
        );
      }
    }

    const revoked = await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    return toView(revoked);
  }

  /** Returns the key's identity if it is valid and not revoked. */
  async authenticate(rawKey: string): Promise<AuthenticatedKey | null> {
    if (!looksLikeApiKey(rawKey)) return null;

    const record = await this.prisma.apiKey.findUnique({
      where: { hash: hashApiKey(rawKey) },
    });
    if (!record || record.revokedAt || !isAccessLevel(record.level)) {
      return null;
    }

    this.touch(record);
    return { id: record.id, name: record.name, level: record.level };
  }

  private touch(record: ApiKey): void {
    const now = Date.now();
    if (
      record.lastUsedAt &&
      now - record.lastUsedAt.getTime() < LAST_USED_RESOLUTION_MS
    ) {
      return;
    }
    this.prisma.apiKey
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date(now) } })
      .catch((error: unknown) =>
        this.logger.warn(
          `Could not update lastUsedAt of key ${record.id}: ${String(error)}`,
        ),
      );
  }
}

function toView(record: ApiKey): ApiKeyView {
  const { hash: _hash, level, ...rest } = record;
  // The database only ever receives validated levels.
  return { ...rest, level: level as AccessLevel };
}
