import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsIP,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../common/dto.js';
import { SLUG_PATTERN } from '../common/slug.js';

const SLUG_MESSAGE =
  'slug must be lowercase words joined by hyphens, with a letter';

export class CreateBulbDto {
  /** IPv4 address of the bulb. Its MAC and model are read from the bulb. */
  @IsIP(4)
  ip!: string;

  /** UDP port; only simulators use something other than 38899. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  /** Defaults to "Wiz <last 6 digits of the MAC>". */
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 64)
  name?: string;

  /** Derived from the name when omitted. */
  @IsOptional()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @Length(1, 64)
  slug?: string;

  @IsOptional()
  @IsInt()
  roomId?: number;
}

export class UpdateBulbDto {
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 64)
  name?: string;

  @IsOptional()
  @Matches(SLUG_PATTERN, { message: SLUG_MESSAGE })
  @Length(1, 64)
  slug?: string;

  /** The room to move the bulb to; `null` removes it from its room. */
  @ApiProperty({ type: Number, nullable: true, required: false })
  @ValidateIf((dto: UpdateBulbDto) => dto.roomId !== null)
  @IsOptional()
  @IsInt()
  roomId?: number | null;

  /** Disabled bulbs are kept but left out of polling and room commands. */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** A new address; the bulb answering there must have the same MAC. */
  @IsOptional()
  @IsIP(4)
  ip?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;
}

export class BulbRoomDto {
  id!: number;
  name!: string;
  slug!: string;
}

export class BulbDto {
  id!: number;
  /** 12 lowercase hex digits; the stable identity of the bulb. */
  mac!: string;
  name!: string;
  slug!: string;
  ip!: string;
  port!: number;

  @ApiProperty({ type: BulbRoomDto, nullable: true })
  room!: BulbRoomDto | null;

  @ApiProperty({ type: String, nullable: true })
  moduleName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  fwVersion!: string | null;

  @ApiProperty({
    enum: ['rgb', 'tunable-white', 'dimmable-white', 'socket', 'unknown'],
  })
  kind!: string;

  @ApiProperty({ type: Number, nullable: true })
  kelvinMin!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  kelvinMax!: number | null;

  enabled!: boolean;

  @ApiProperty({ type: Date, nullable: true })
  lastSeenAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}
