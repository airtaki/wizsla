import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const API_KEY_SCHEME = 'api-key';

/**
 * Swagger UI at /docs and the OpenAPI document at /docs-json. The UI is
 * served from the installed package, so it works without internet access.
 */
export function setupSwagger(app: INestApplication): void {
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

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
}
