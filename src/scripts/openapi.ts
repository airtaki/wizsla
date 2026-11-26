/**
 * Writes the API's OpenAPI document, which the web app's typed API client
 * is generated from:
 *
 *   npm run openapi            (writes web/openapi.json)
 *
 * Requires a build first (`npm run build`): the Swagger CLI plugin adds the
 * DTO metadata at compile time. Preview mode builds the module graph without
 * creating providers, so no database, bulbs or `.env` are needed.
 */
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { createOpenApiDocument } from '../swagger.js';

const out = process.argv[2] ?? 'web/openapi.json';

const app = await NestFactory.create(AppModule, {
  preview: true,
  logger: false,
});
const document = createOpenApiDocument(app);
await app.close();

writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Wrote ${out} (${Object.keys(document.paths).length} paths).`);
