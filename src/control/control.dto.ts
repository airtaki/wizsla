import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  NotEquals,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  KELVIN_MAX,
  KELVIN_MIN,
  SPEED_MAX,
  SPEED_MIN,
} from '../wiz/protocol.js';
import { BulbStateDto } from '../state/state.dto.js';

/** A scene id (number) or a scene name / slug (string). */
function IsSceneRef(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isSceneRef',
      validator: {
        validate: (value: unknown) =>
          (typeof value === 'number' && Number.isInteger(value)) ||
          (typeof value === 'string' && value.length > 0 && value.length <= 64),
        defaultMessage: () => 'scene must be a scene id or name',
      },
    },
    options,
  );
}

/**
 * What to do with the light. Every field is optional, but at least one is
 * needed. Setting anything but `on` also switches the light on.
 *
 * - `color`, `colorTemp` / `colorTempDelta` and `scene` exclude each other.
 * - `brightness` and `brightnessDelta` exclude each other.
 * - `on: false` cannot be combined with anything else.
 */
export class LightCommandDto {
  @IsOptional()
  @IsBoolean()
  on?: boolean;

  /** 10–100 %. */
  @IsOptional()
  @IsInt()
  @Min(BRIGHTNESS_MIN)
  @Max(BRIGHTNESS_MAX)
  brightness?: number;

  /** Change in percentage points, e.g. -10; the result stays within 10–100. */
  @IsOptional()
  @IsInt()
  @Min(-(BRIGHTNESS_MAX - BRIGHTNESS_MIN))
  @Max(BRIGHTNESS_MAX - BRIGHTNESS_MIN)
  @NotEquals(0)
  brightnessDelta?: number;

  /** Kelvin; must fit the bulb's range (2200–6500 for most colour bulbs). */
  @IsOptional()
  @IsInt()
  @Min(KELVIN_MIN)
  @Max(KELVIN_MAX)
  colorTemp?: number;

  /**
   * Change in Kelvin, e.g. -300 for warmer; the result stays within the
   * bulb's range. Works in white mode and in static white scenes (Warm
   * White, Daylight...), not in colour mode or dynamic scenes.
   */
  @IsOptional()
  @IsInt()
  @Min(-(KELVIN_MAX - KELVIN_MIN))
  @Max(KELVIN_MAX - KELVIN_MIN)
  @NotEquals(0)
  colorTempDelta?: number;

  /** RGB colour as `#RRGGBB`. */
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be #RRGGBB' })
  color?: string;

  /** Cold white channel (0–255) mixed into `color`. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(255)
  coldWhite?: number;

  /** Warm white channel (0–255) mixed into `color`. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(255)
  warmWhite?: number;

  /** Scene id or name, e.g. 3, "sunset" or "Warm White"; see GET /scenes. */
  @ApiProperty({
    oneOf: [{ type: 'integer' }, { type: 'string' }],
    required: false,
    example: 'sunset',
  })
  @IsOptional()
  @IsSceneRef()
  scene?: number | string;

  /** Animation speed of dynamic scenes, 10–200 %. */
  @IsOptional()
  @IsInt()
  @Min(SPEED_MIN)
  @Max(SPEED_MAX)
  speed?: number;
}

export type CommandStatus = 'ok' | 'offline' | 'unsupported' | 'failed';

export class BulbCommandResultDto {
  /**
   * `ok`: done. `offline`: the bulb did not answer. `unsupported`: the bulb
   * cannot do this (e.g. colour on a white bulb). `failed`: the bulb refused
   * or answered wrongly.
   */
  @ApiProperty({ enum: ['ok', 'offline', 'unsupported', 'failed'] })
  status!: CommandStatus;

  /** Why it was not done. */
  error?: string;

  /** The bulb with its state read back after the command. */
  @Type(() => BulbStateDto)
  bulb!: BulbStateDto;
}

export class CommandSummaryDto {
  /** Enabled bulbs addressed; disabled bulbs are left out. */
  bulbs!: number;
  ok!: number;
  offline!: number;
  unsupported!: number;
  failed!: number;
}

export class GroupCommandResultDto {
  summary!: CommandSummaryDto;
  results!: BulbCommandResultDto[];
}

export class SceneDto {
  id!: number;
  name!: string;
  slug!: string;

  @ApiProperty({
    enum: ['rgb', 'tunable-white', 'dimmable-white'],
    isArray: true,
  })
  supportedKinds!: string[];

  /** Whether `speed` can be set. */
  speedAdjustable!: boolean;

  /** Whether `brightness` can be set. */
  dimmable!: boolean;
}

export class CommandLogDto {
  id!: number;
  createdAt!: Date;
  keyName!: string;

  @ApiProperty({ enum: ['bulb', 'room', 'all'] })
  target!: string;

  @ApiProperty({ type: Number, nullable: true })
  targetId!: number | null;

  targetName!: string;

  /** The command as it was sent. */
  @ApiProperty({ type: Object })
  command!: Record<string, unknown>;

  bulbs!: number;
  succeeded!: number;
  durationMs!: number;
}

export class CommandLogQueryDto {
  /** How many entries to return, newest first (1–500, default 50). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
