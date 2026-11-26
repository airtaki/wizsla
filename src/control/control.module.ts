import { Module } from '@nestjs/common';
import { BulbsModule } from '../bulbs/bulbs.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { StateModule } from '../state/state.module.js';
import { CommandLogService } from './command-log.service.js';
import { ControlController } from './control.controller.js';
import { ControlService } from './control.service.js';

@Module({
  imports: [StateModule, RoomsModule, BulbsModule],
  controllers: [ControlController],
  providers: [ControlService, CommandLogService],
})
export class ControlModule {}
