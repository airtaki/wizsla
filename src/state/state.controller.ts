import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { RequireLevel } from '../auth/decorators.js';
import {
  BulbStateDto,
  RoomStateDto,
  StateOverviewDto,
  StateQueryDto,
} from './state.dto.js';
import { StateService } from './state.service.js';

/**
 * Current state of the lights. Answers come from the background poll
 * (see `checkedAt`); `?refresh=true` asks the bulbs first.
 */
@ApiTags('State')
@RequireLevel('read')
@Controller()
export class StateController {
  constructor(private readonly state: StateService) {}

  /** Every room and bulb, with summaries. */
  @Get('state')
  overview(@Query() query: StateQueryDto): Promise<StateOverviewDto> {
    return this.state.overview(query.refresh);
  }

  @ApiParam({ name: 'ref', description: 'Room id or slug' })
  @Get('rooms/:ref/state')
  room(
    @Param('ref') ref: string,
    @Query() query: StateQueryDto,
  ): Promise<RoomStateDto> {
    return this.state.room(ref, query.refresh);
  }

  @ApiParam({ name: 'ref', description: 'Bulb id or slug' })
  @Get('bulbs/:ref/state')
  bulb(
    @Param('ref') ref: string,
    @Query() query: StateQueryDto,
  ): Promise<BulbStateDto> {
    return this.state.bulb(ref, query.refresh);
  }
}
