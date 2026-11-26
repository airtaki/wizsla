import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  type ExceptionFilter,
  GatewayTimeoutException,
  type HttpException,
  BadGatewayException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import {
  WizError,
  WizInvalidParamsError,
  WizUnreachableError,
} from '../wiz/errors.js';

function send(host: ArgumentsHost, exception: HttpException): void {
  host
    .switchToHttp()
    .getResponse<Response>()
    .status(exception.getStatus())
    .json(exception.getResponse());
}

/**
 * Bulb errors as HTTP errors: an unreachable bulb is a 504, a bulb that
 * answered wrongly or refused is a 502, invalid parameters are a 400.
 */
@Catch(WizError)
export class WizErrorFilter implements ExceptionFilter<WizError> {
  catch(error: WizError, host: ArgumentsHost): void {
    const exception =
      error instanceof WizUnreachableError
        ? new GatewayTimeoutException(error.message)
        : error instanceof WizInvalidParamsError
          ? new BadRequestException(error.message)
          : new BadGatewayException(error.message);
    send(host, exception);
  }
}

/** Unique constraint violations become 409, missing records 404. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaErrorFilter implements ExceptionFilter<Prisma.PrismaClientKnownRequestError> {
  catch(
    error: Prisma.PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ): void {
    switch (error.code) {
      case 'P2002':
        return send(
          host,
          new ConflictException(`Already exists: ${uniqueTarget(error)}`),
        );
      case 'P2025':
        return send(host, new NotFoundException('Record not found'));
      default:
        this.logger.error(
          `Unexpected database error ${error.code}: ${error.message}`,
        );
        return send(host, new InternalServerErrorException());
    }
  }

  private readonly logger = new Logger(PrismaErrorFilter.name);
}

/** The violated unique field(s); where they are depends on the driver. */
function uniqueTarget(error: Prisma.PrismaClientKnownRequestError): string {
  const meta = error.meta as
    | {
        target?: unknown;
        driverAdapterError?: {
          cause?: { constraint?: { fields?: unknown } };
        };
      }
    | undefined;
  const fields =
    meta?.target ?? meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(fields)) return fields.join(', ');
  if (typeof fields === 'string') return fields;
  return 'a record with the same unique value';
}
