import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ApiKeyDto,
  CreateApiKeyDto,
  CreatedApiKeyDto,
} from './api-keys.dto.js';
import { ApiKeysService } from './api-keys.service.js';
import { RequireLevel } from './decorators.js';

@ApiTags('API keys')
@RequireLevel('admin')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  list(): Promise<ApiKeyDto[]> {
    return this.apiKeys.list();
  }

  /** Creates a key. The response contains the full key, only this once. */
  @Post()
  create(@Body() dto: CreateApiKeyDto): Promise<CreatedApiKeyDto> {
    return this.apiKeys.create(dto.name, dto.level);
  }

  /** Revokes a key. The last active admin key cannot be revoked. */
  @Delete(':id')
  revoke(@Param('id', ParseIntPipe) id: number): Promise<ApiKeyDto> {
    return this.apiKeys.revoke(id);
  }
}
