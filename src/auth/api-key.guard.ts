import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type AccessLevel, grants } from './access-level.js';
import { ApiKeysService } from './api-keys.service.js';
import {
  type AuthenticatedRequest,
  IS_PUBLIC,
  REQUIRED_LEVEL,
} from './decorators.js';

/**
 * Global guard: every endpoint needs a valid API key unless it is marked
 * `@Public()`. The key goes in `X-API-Key: <key>` or
 * `Authorization: Bearer <key>`.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeys: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawKey = extractKey(request);
    if (!rawKey) throw new UnauthorizedException('API key required');

    const apiKey = await this.apiKeys.authenticate(rawKey);
    if (!apiKey) throw new UnauthorizedException('Invalid or revoked API key');

    const required =
      this.reflector.getAllAndOverride<AccessLevel>(REQUIRED_LEVEL, targets) ??
      'admin';
    if (!grants(apiKey.level, required)) {
      throw new ForbiddenException(
        `This endpoint requires the "${required}" level`,
      );
    }

    request.apiKey = apiKey;
    return true;
  }
}

function extractKey(request: AuthenticatedRequest): string | undefined {
  const header = request.header('x-api-key');
  if (header) return header.trim();

  const authorization = request.header('authorization');
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1];
}
