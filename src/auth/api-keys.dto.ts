import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';
import { ACCESS_LEVELS, type AccessLevel } from './access-level.js';

export class CreateApiKeyDto {
  /** Who will use the key, e.g. "Telefon" or "AI agent". */
  @IsString()
  @Length(1, 64)
  name!: string;

  @ApiProperty({ enum: ACCESS_LEVELS })
  @IsIn(ACCESS_LEVELS)
  level!: AccessLevel;
}

export class ApiKeyDto {
  id!: number;
  name!: string;
  /** First characters of the key, to recognise it. */
  prefix!: string;

  @ApiProperty({ enum: ACCESS_LEVELS })
  level!: AccessLevel;

  createdAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  lastUsedAt!: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  revokedAt!: Date | null;
}

export class CreatedApiKeyDto {
  apiKey!: ApiKeyDto;
  /** The full key. It is shown only now; store it safely. */
  key!: string;
}
