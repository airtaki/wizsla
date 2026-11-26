import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import {
  type AuthenticatedKey,
  CurrentApiKey,
  RequireLevel,
} from '../auth/decorators.js';
import { SCENES } from '../wiz/scenes.js';
import { CommandLogService } from './command-log.service.js';
import {
  BulbCommandResultDto,
  CommandLogDto,
  CommandLogQueryDto,
  GroupCommandResultDto,
  LightCommandDto,
  SceneDto,
} from './control.dto.js';
import { ControlService } from './control.service.js';

@ApiTags('Control')
@Controller()
export class ControlController {
  constructor(
    private readonly control: ControlService,
    private readonly log: CommandLogService,
  ) {}

  /**
   * Controls one bulb and returns its state read back afterwards. Errors:
   * 400 if the bulb cannot do it, 504 if it does not answer, 409 if it is
   * disabled.
   */
  @RequireLevel('control')
  @ApiParam({ name: 'ref', description: 'Bulb id or slug' })
  @Patch('bulbs/:ref/state')
  bulb(
    @Param('ref') ref: string,
    @Body() dto: LightCommandDto,
    @CurrentApiKey() key?: AuthenticatedKey,
  ): Promise<BulbCommandResultDto> {
    return this.control.bulb(ref, dto, key);
  }

  /**
   * Controls every enabled bulb of a room at once. Always 200: check each
   * bulb's `status`, or the summary.
   */
  @RequireLevel('control')
  @ApiParam({ name: 'ref', description: 'Room id or slug' })
  @Patch('rooms/:ref/state')
  room(
    @Param('ref') ref: string,
    @Body() dto: LightCommandDto,
    @CurrentApiKey() key?: AuthenticatedKey,
  ): Promise<GroupCommandResultDto> {
    return this.control.room(ref, dto, key);
  }

  /** Controls every enabled bulb, in a room or not. */
  @RequireLevel('control')
  @Patch('state')
  all(
    @Body() dto: LightCommandDto,
    @CurrentApiKey() key?: AuthenticatedKey,
  ): Promise<GroupCommandResultDto> {
    return this.control.all(dto, key);
  }

  /** The built-in Wiz scenes and which bulbs can play them. */
  @RequireLevel('read')
  @Get('scenes')
  scenes(): SceneDto[] {
    return SCENES.map((scene) => ({
      ...scene,
      supportedKinds: [...scene.supportedKinds],
    }));
  }

  /** Recent commands, newest first. */
  @RequireLevel('admin')
  @Get('commands')
  commands(@Query() query: CommandLogQueryDto): Promise<CommandLogDto[]> {
    return this.log.list(query.limit);
  }
}
