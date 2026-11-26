import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { type Env, logLevelsFrom } from './config/env.js';
import { setupSwagger } from './swagger.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.useLogger(
    new ConsoleLogger({
      logLevels: logLevelsFrom(config.get('LOG_LEVEL', { infer: true })),
      json: config.get('LOG_FORMAT', { infer: true }) === 'json',
    }),
  );
  app.enableShutdownHooks();
  setupSwagger(app);

  await app.listen(
    config.get('PORT', { infer: true }),
    config.get('HOST', { infer: true }),
  );
}

await bootstrap();
