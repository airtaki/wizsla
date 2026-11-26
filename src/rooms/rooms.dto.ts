import { PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Trim } from '../common/dto.js';
import { SLUG_PATTERN } from '../common/slug.js';

export class CreateRoomDto {
  /** Display name, e.g. "Nappali". */
  @Trim()
  @IsString()
  @Length(1, 64)
  name!: string;

  /**
   * Lowercase letters, digits and hyphens, at least one letter. Derived from
   * the name when omitted ("Étkező" → "etkezo").
   */
  @IsOptional()
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase words joined by hyphens, with a letter',
  })
  @Length(1, 64)
  slug?: string;

  /** Position in listings, ascending. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;
}

export class UpdateRoomDto extends PartialType(CreateRoomDto) {}

export class RoomBulbDto {
  id!: number;
  name!: string;
  slug!: string;
}

export class RoomDto {
  id!: number;
  name!: string;
  slug!: string;
  sortOrder!: number;
  bulbs!: RoomBulbDto[];
  createdAt!: Date;
  updatedAt!: Date;
}
