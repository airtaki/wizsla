import { setTimeout as sleep } from 'node:timers/promises';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { parseRef, slugFor } from '../common/slug.js';
import { sortByName } from '../common/sort.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { capabilitiesFromModule } from '../wiz/capabilities.js';
import type { BulbAddress } from '../wiz/protocol.js';
import { WizClient } from '../wiz/wiz-client.js';
import { WizSettings } from '../wiz/wiz.module.js';
import type { BulbDto, CreateBulbDto, UpdateBulbDto } from './bulbs.dto.js';

export const bulbInclude = {
  room: { select: { id: true, name: true, slug: true } },
} as const;

/** How the identify blink looks: this many flashes, this far apart. */
export const IDENTIFY_FLASHES = 3;
export const IDENTIFY_INTERVAL_MS = 300;

/** What the bulb itself tells about its hardware. */
export interface BulbHardware {
  mac: string;
  moduleName: string;
  fwVersion: string | null;
  kind: string;
  kelvinMin: number | null;
  kelvinMax: number | null;
}

@Injectable()
export class BulbsService {
  private readonly logger = new Logger(BulbsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wiz: WizClient,
    private readonly settings: WizSettings,
  ) {}

  /**
   * @param room a room id or slug, or `none` for bulbs without a room
   */
  async list(room?: string): Promise<BulbDto[]> {
    let where: Prisma.BulbWhereInput = {};
    if (room === 'none') {
      where = { roomId: null };
    } else if (room !== undefined) {
      const found = await this.prisma.room.findUnique({
        where: parseRef(room),
      });
      if (!found) throw new NotFoundException(`Room "${room}" not found`);
      where = { roomId: found.id };
    }
    return sortByName(
      await this.prisma.bulb.findMany({ where, include: bulbInclude }),
    );
  }

  async get(ref: string): Promise<BulbDto> {
    const bulb = await this.prisma.bulb.findUnique({
      where: parseRef(ref),
      include: bulbInclude,
    });
    if (!bulb) throw new NotFoundException(`Bulb "${ref}" not found`);
    return bulb;
  }

  /** Adds a bulb by address; its MAC and model are read from the bulb. */
  async create(dto: CreateBulbDto): Promise<BulbDto> {
    const address = { ip: dto.ip, port: dto.port ?? this.settings.port };
    const hardware = await this.readHardware(address);

    const existing = await this.prisma.bulb.findUnique({
      where: { mac: hardware.mac },
    });
    if (existing) {
      throw new ConflictException(
        `This bulb (${hardware.mac}) is already registered as "${existing.name}" (#${existing.id})`,
      );
    }
    await this.assertRoomExists(dto.roomId);

    const name = dto.name ?? defaultBulbName(hardware.mac);
    return this.prisma.bulb.create({
      data: {
        ...hardware,
        ...address,
        name,
        slug: slugFor(dto.slug, name),
        roomId: dto.roomId,
        lastSeenAt: new Date(),
      },
      include: bulbInclude,
    });
  }

  async update(ref: string, dto: UpdateBulbDto): Promise<BulbDto> {
    const bulb = await this.get(ref);
    await this.assertRoomExists(dto.roomId);

    const ip = dto.ip ?? bulb.ip;
    const port = dto.port ?? bulb.port;
    if (ip !== bulb.ip || port !== bulb.port) {
      const hardware = await this.readHardware({ ip, port });
      if (hardware.mac !== bulb.mac) {
        throw new ConflictException(
          `A different bulb (${hardware.mac}) answers at ${ip}:${port}`,
        );
      }
    }

    return this.prisma.bulb.update({
      where: { id: bulb.id },
      data: {
        name: dto.name,
        slug: dto.slug,
        roomId: dto.roomId,
        enabled: dto.enabled,
        ip,
        port,
      },
      include: bulbInclude,
    });
  }

  async remove(ref: string): Promise<void> {
    const bulb = await this.get(ref);
    await this.prisma.bulb.delete({ where: { id: bulb.id } });
  }

  /**
   * Blinks the bulb so it can be found physically, then leaves it as it was.
   * Wiz bulbs keep their colour and brightness while switched off, so
   * toggling the power is enough.
   */
  async identify(ref: string): Promise<void> {
    const bulb = await this.get(ref);
    const address = { ip: bulb.ip, port: bulb.port };
    const { on } = await this.wiz.getPilot(address);

    try {
      for (let i = 0; i < IDENTIFY_FLASHES * 2; i++) {
        const flipped = i % 2 === 0;
        await this.wiz.setPilot(address, { state: flipped ? !on : on });
        await sleep(IDENTIFY_INTERVAL_MS);
      }
    } catch (error) {
      await this.wiz.setPilot(address, { state: on }).catch(() => {
        this.logger.warn(`Could not restore ${bulb.name} after identify`);
      });
      throw error;
    }
  }

  /** Reads MAC, model, firmware and capabilities from the bulb itself. */
  async readHardware(address: BulbAddress): Promise<BulbHardware> {
    const config = await this.wiz.getSystemConfig(address);
    const model = await this.wiz.getModelConfig(address);
    const capabilities = capabilitiesFromModule(config.moduleName, model);
    return {
      mac: config.mac.toLowerCase(),
      moduleName: config.moduleName,
      fwVersion: config.fwVersion ?? null,
      kind: capabilities.kind,
      kelvinMin: capabilities.colorTemp?.min ?? null,
      kelvinMax: capabilities.colorTemp?.max ?? null,
    };
  }

  private async assertRoomExists(
    roomId: number | null | undefined,
  ): Promise<void> {
    if (roomId === undefined || roomId === null) return;
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new BadRequestException(`Room #${roomId} does not exist`);
  }
}

export function defaultBulbName(mac: string): string {
  return `Wiz ${mac.slice(-6)}`;
}
