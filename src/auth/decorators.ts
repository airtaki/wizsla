import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AccessLevel } from './access-level.js';

export const IS_PUBLIC = 'wizsla:public';
export const REQUIRED_LEVEL = 'wizsla:required-level';

/** The endpoint needs no API key (e.g. the health check). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * Minimum access level for a controller or handler. Endpoints without it
 * require `admin`, so a forgotten annotation fails safe.
 */
export const RequireLevel = (level: AccessLevel) =>
  SetMetadata(REQUIRED_LEVEL, level);

/** The key that authenticated the current request. */
export interface AuthenticatedKey {
  id: number;
  name: string;
  level: AccessLevel;
}

export type AuthenticatedRequest = Request & { apiKey?: AuthenticatedKey };

/** Injects the {@link AuthenticatedKey} of the current request. */
export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedKey | undefined =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().apiKey,
);
