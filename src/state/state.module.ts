import { Module } from '@nestjs/common';
import { BulbsModule } from '../bulbs/bulbs.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { StateController } from './state.controller.js';
import { StatePoller } from './state.poller.js';
import { StateService } from './state.service.js';

@Module({
  imports: [RoomsModule, BulbsModule],
  controllers: [StateController],
  providers: [StateService, StatePoller],
  exports: [StateService],
})
export class StateModule {}
