import { Module } from '@nestjs/common';
import { BulbsController } from './bulbs.controller.js';
import { BulbsService } from './bulbs.service.js';

@Module({
  controllers: [BulbsController],
  providers: [BulbsService],
  exports: [BulbsService],
})
export class BulbsModule {}
