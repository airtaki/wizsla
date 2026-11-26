import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireLevel } from '../auth/decorators.js';
import { DiscoveryResultDto } from './discovery.dto.js';
import { DiscoveryService } from './discovery.service.js';

@ApiTags('Discovery')
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  /**
   * Searches the network for Wiz bulbs (takes about two seconds). New bulbs
   * are registered without a room; known bulbs get their current IP.
   */
  @RequireLevel('admin')
  @Post('scan')
  @HttpCode(200)
  scan(): Promise<DiscoveryResultDto> {
    return this.discovery.scan();
  }
}
