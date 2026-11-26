import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { BulbsModule } from './bulbs/bulbs.module.js';
import { PrismaErrorFilter, WizErrorFilter } from './common/error-filters.js';
import { ControlModule } from './control/control.module.js';
import { CoreModule } from './core.module.js';
import { BackupScheduler } from './database/backup.scheduler.js';
import { DiscoveryModule } from './discovery/discovery.module.js';
import { HealthModule } from './health/health.module.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { StateModule } from './state/state.module.js';
import { WizModule } from './wiz/wiz.module.js';

@Module({
  imports: [
    CoreModule,
    WizModule,
    AuthModule,
    HealthModule,
    RoomsModule,
    BulbsModule,
    DiscoveryModule,
    StateModule,
    ControlModule,
  ],
  providers: [
    BackupScheduler,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: WizErrorFilter },
    { provide: APP_FILTER, useClass: PrismaErrorFilter },
  ],
})
export class AppModule {}
