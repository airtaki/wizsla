import { ApiProperty } from '@nestjs/swagger';
import { BulbDto } from '../bulbs/bulbs.dto.js';

export class DiscoveredBulbDto {
  /**
   * `new`: registered now, without a room. `moved`: known bulb with a new
   * IP, updated. `known`: known bulb at the same IP.
   */
  @ApiProperty({ enum: ['new', 'moved', 'known'] })
  status!: 'new' | 'moved' | 'known';

  /** The IP the bulb had before, for `moved` bulbs. */
  previousIp?: string;

  bulb!: BulbDto;
}

export class FailedDiscoveryDto {
  ip!: string;
  mac!: string;
  error!: string;
}

export class DiscoveryResultDto {
  /** Bulbs that answered, in IP order. */
  bulbs!: DiscoveredBulbDto[];
  /** Bulbs that answered the broadcast but not the follow-up questions. */
  failed!: FailedDiscoveryDto[];
  /** Registered bulbs that did not answer (off at the switch, or gone). */
  missing!: BulbDto[];
}
