import { Injectable, Logger } from '@nestjs/common';
import {
  BulbsService,
  bulbInclude,
  defaultBulbName,
} from '../bulbs/bulbs.service.js';
import { slugFor } from '../common/slug.js';
import { sortByName } from '../common/sort.js';
import { PrismaService } from '../database/prisma.service.js';
import { WizClient } from '../wiz/wiz-client.js';
import { WizSettings } from '../wiz/wiz.module.js';
import type {
  DiscoveredBulbDto,
  DiscoveryResultDto,
  FailedDiscoveryDto,
} from './discovery.dto.js';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wiz: WizClient,
    private readonly bulbs: BulbsService,
    private readonly settings: WizSettings,
  ) {}

  /**
   * Finds the Wiz bulbs on the network and brings the database up to date:
   * new bulbs are registered without a room, known bulbs get their current
   * IP, firmware and model. Nothing is ever deleted.
   */
  async scan(): Promise<DiscoveryResultDto> {
    const found = await this.wiz.discover({
      broadcastAddress: this.settings.broadcastAddress,
      port: this.settings.port,
      durationMs: this.settings.discoveryMs,
    });

    const bulbs: DiscoveredBulbDto[] = [];
    const failed: FailedDiscoveryDto[] = [];

    // One at a time: a handful of bulbs, and no write contention on SQLite.
    for (const { ip, mac } of found) {
      try {
        bulbs.push(await this.register(ip));
      } catch (error) {
        failed.push({ ip, mac, error: (error as Error).message });
      }
    }

    const seen = new Set(bulbs.map((b) => b.bulb.mac));
    const missing = sortByName(
      await this.prisma.bulb.findMany({
        where: { mac: { notIn: [...seen] } },
        include: bulbInclude,
      }),
    );

    this.logger.log(
      `Discovery: ${bulbs.length} answered (${bulbs.filter((b) => b.status === 'new').length} new), ${failed.length} failed, ${missing.length} missing`,
    );
    return { bulbs, failed, missing };
  }

  private async register(ip: string): Promise<DiscoveredBulbDto> {
    const address = { ip, port: this.settings.port };
    const hardware = await this.bulbs.readHardware(address);
    const existing = await this.prisma.bulb.findUnique({
      where: { mac: hardware.mac },
    });

    if (!existing) {
      const name = defaultBulbName(hardware.mac);
      const bulb = await this.prisma.bulb.create({
        data: {
          ...hardware,
          ...address,
          name,
          slug: slugFor(undefined, name),
          lastSeenAt: new Date(),
        },
        include: bulbInclude,
      });
      return { status: 'new', bulb };
    }

    const moved = existing.ip !== ip || existing.port !== address.port;
    const bulb = await this.prisma.bulb.update({
      where: { id: existing.id },
      data: { ...hardware, ...address, lastSeenAt: new Date() },
      include: bulbInclude,
    });
    return moved
      ? { status: 'moved', previousIp: existing.ip, bulb }
      : { status: 'known', bulb };
  }
}
