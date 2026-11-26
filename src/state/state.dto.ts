import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { BulbRoomDto } from '../bulbs/bulbs.dto.js';

export class StateQueryDto {
  /** Ask the bulbs now instead of answering from the last poll. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  refresh?: boolean;
}

export class RgbDto {
  r!: number;
  g!: number;
  b!: number;
}

export class SceneRefDto {
  id!: number;
  name!: string;
  slug!: string;
}

/** What the bulb reported about its light. */
export class LightStateDto {
  on!: boolean;

  /** `white` (colour temperature), `color` (RGB), or a built-in `scene`. */
  @ApiProperty({ enum: ['white', 'color', 'scene', 'unknown'] })
  mode!: 'white' | 'color' | 'scene' | 'unknown';

  /** 10–100 %. The bulb keeps it while switched off. */
  brightness?: number;

  /** Kelvin, in `white` mode. */
  colorTemp?: number;

  /** In `color` mode. */
  color?: RgbDto;

  /** Cold and warm white channels (0–255) mixed into `color`. */
  coldWhite?: number;
  warmWhite?: number;

  /** In `scene` mode. */
  scene?: SceneRefDto;

  /** Scene animation speed, 10–200 %. */
  speed?: number;

  /** Wi-Fi signal strength in dBm; below about −80 the bulb may drop out. */
  rssi?: number;
}

export class BulbStateDto {
  id!: number;
  name!: string;
  slug!: string;

  @ApiProperty({ type: BulbRoomDto, nullable: true })
  room!: BulbRoomDto | null;

  /** Disabled bulbs are not polled. */
  enabled!: boolean;

  /**
   * Whether the bulb answered the last check. `null` for a disabled bulb that
   * has not been checked since the service started.
   */
  @ApiProperty({ type: Boolean, nullable: true })
  online!: boolean | null;

  /**
   * The last state the bulb reported. Kept while the bulb is offline, so
   * check `online` and `stateAt` before trusting it.
   */
  @ApiProperty({ type: LightStateDto, nullable: true })
  state!: LightStateDto | null;

  /** When `state` was read. */
  @ApiProperty({ type: Date, nullable: true })
  stateAt!: Date | null;

  /** When the bulb was last asked, whether or not it answered. */
  @ApiProperty({ type: Date, nullable: true })
  checkedAt!: Date | null;

  /** Why the last check failed. */
  error?: string;
}

export class StateSummaryDto {
  /** Bulbs counted, disabled ones included. */
  total!: number;
  online!: number;
  /** Online bulbs that are switched on. */
  on!: number;

  /** Average brightness of the bulbs that are on. */
  @ApiProperty({ type: Number, nullable: true })
  brightness!: number | null;

  /** Average colour temperature of the bulbs that are on in `white` mode. */
  @ApiProperty({ type: Number, nullable: true })
  colorTemp!: number | null;
}

export class RoomStateDto {
  id!: number;
  name!: string;
  slug!: string;
  summary!: StateSummaryDto;
  bulbs!: BulbStateDto[];
}

export class StateOverviewDto {
  /** Every bulb together. */
  summary!: StateSummaryDto;
  /** Rooms in display order, each with its bulbs. */
  rooms!: RoomStateDto[];
  /** Bulbs that are not in a room. */
  unassigned!: BulbStateDto[];
}
