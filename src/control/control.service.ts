import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedKey } from '../auth/decorators.js';
import { BulbsService } from '../bulbs/bulbs.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { type BulbRow, StateService } from '../state/state.service.js';
import { WizError, WizUnreachableError } from '../wiz/errors.js';
import { WizClient } from '../wiz/wiz-client.js';
import {
  type Command,
  needsCurrentState,
  parseCommand,
  planFor,
} from './command.js';
import {
  CommandLogService,
  type CommandRecord,
} from './command-log.service.js';
import type {
  BulbCommandResultDto,
  GroupCommandResultDto,
  LightCommandDto,
} from './control.dto.js';

/** Carries out light commands on one bulb, a room, or every bulb. */
@Injectable()
export class ControlService {
  constructor(
    private readonly wiz: WizClient,
    private readonly state: StateService,
    private readonly rooms: RoomsService,
    private readonly bulbs: BulbsService,
    private readonly log: CommandLogService,
  ) {}

  /**
   * One bulb. A bulb that cannot carry the command out is an HTTP error:
   * 400 unsupported, 504 offline, 502 failed.
   */
  async bulb(
    ref: string,
    dto: LightCommandDto,
    key?: AuthenticatedKey,
  ): Promise<BulbCommandResultDto> {
    const command = parseCommand(dto);
    const { id } = await this.bulbs.get(ref);
    const [bulb] = await this.state.loadBulbs({ id });
    if (!bulb.enabled) {
      throw new ConflictException(`The bulb "${bulb.name}" is disabled`);
    }

    const startedAt = Date.now();
    const result = await this.apply(bulb, command);
    await this.record({
      key,
      target: 'bulb',
      targetId: bulb.id,
      targetName: bulb.name,
      command: dto,
      results: [result],
      startedAt,
    });

    switch (result.status) {
      case 'ok':
        return result;
      case 'unsupported':
        throw new BadRequestException(result.error);
      case 'offline':
        throw new GatewayTimeoutException(result.error);
      case 'failed':
        throw new BadGatewayException(result.error);
    }
  }

  /** Every enabled bulb of a room, in parallel. */
  async room(
    ref: string,
    dto: LightCommandDto,
    key?: AuthenticatedKey,
  ): Promise<GroupCommandResultDto> {
    const command = parseCommand(dto);
    const room = await this.rooms.resolve(ref);
    const bulbs = await this.state.loadBulbs({ roomId: room.id });
    return this.group(bulbs, command, {
      key,
      target: 'room',
      targetId: room.id,
      targetName: room.name,
      command: dto,
    });
  }

  /** Every enabled bulb, in or out of a room. */
  async all(
    dto: LightCommandDto,
    key?: AuthenticatedKey,
  ): Promise<GroupCommandResultDto> {
    const command = parseCommand(dto);
    const bulbs = await this.state.loadBulbs();
    return this.group(bulbs, command, {
      key,
      target: 'all',
      targetId: null,
      targetName: 'all bulbs',
      command: dto,
    });
  }

  private async group(
    bulbs: BulbRow[],
    command: Command,
    entry: Omit<CommandRecord, 'results' | 'startedAt'>,
  ): Promise<GroupCommandResultDto> {
    const startedAt = Date.now();
    const results = await Promise.all(
      bulbs.filter((b) => b.enabled).map((b) => this.apply(b, command)),
    );
    await this.record({ ...entry, results, startedAt });

    const count = (status: BulbCommandResultDto['status']) =>
      results.filter((r) => r.status === status).length;
    return {
      summary: {
        bulbs: results.length,
        ok: count('ok'),
        offline: count('offline'),
        unsupported: count('unsupported'),
        failed: count('failed'),
      },
      results,
    };
  }

  private async apply(
    bulb: BulbRow,
    command: Command,
  ): Promise<BulbCommandResultDto> {
    const address = { ip: bulb.ip, port: bulb.port };
    let current;
    if (needsCurrentState(command)) {
      current = await this.state.freshState(bulb);
      if (!current) {
        return {
          status: 'offline',
          error: 'The bulb did not answer, so its current state is unknown',
          bulb: this.state.describe(bulb),
        };
      }
    }

    const plan = planFor(bulb, command, current ?? undefined);
    if ('unsupported' in plan) {
      return {
        status: 'unsupported',
        error: plan.unsupported,
        bulb: this.state.describe(bulb),
      };
    }

    try {
      await this.wiz.setPilot(address, plan.params);
    } catch (error) {
      if (!(error instanceof WizError)) throw error;
      if (error instanceof WizUnreachableError) {
        this.state.markUnreachable(bulb, error.message);
        return {
          status: 'offline',
          error: error.message,
          bulb: this.state.describe(bulb),
        };
      }
      return {
        status: 'failed',
        error: error.message,
        bulb: this.state.describe(bulb),
      };
    }

    return { status: 'ok', bulb: await this.state.readAfterCommand(bulb) };
  }

  private record(entry: CommandRecord): Promise<void> {
    return this.log.record(entry);
  }
}
