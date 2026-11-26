import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';

/** Configuration and database: shared by the HTTP app and the CLI. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    DatabaseModule,
  ],
})
export class CoreModule {}
