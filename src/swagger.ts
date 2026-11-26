import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';

export const API_KEY_SCHEME = 'api-key';

/**
 * Swagger UI at /docs and the OpenAPI document at /docs-json. The UI is
 * served from the installed package, so it works without internet access.
 */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, createOpenApiDocument(app), {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
}

/** The OpenAPI document of every controller in the app. */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Wizsla')
    .setDescription('Local REST API for Wiz smart bulbs.')
    .setVersion('2')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      API_KEY_SCHEME,
    )
    .addSecurityRequirements(API_KEY_SCHEME)
    .build();

  return SwaggerModule.createDocument(app, config);
}
