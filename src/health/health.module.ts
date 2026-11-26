import { Module } from '@nestjs/common';
import { StateModule } from '../state/state.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [StateModule],
  controllers: [HealthController],
})
export class HealthModule {}
