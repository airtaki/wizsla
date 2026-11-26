import { Injectable, NotFoundException } from '@nestjs/common';
import { parseRef, slugFor } from '../common/slug.js';
import { compareNames, sortByName } from '../common/sort.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Room } from '../generated/prisma/client.js';
import type { CreateRoomDto, RoomDto, UpdateRoomDto } from './rooms.dto.js';

const withBulbs = {
  bulbs: { select: { id: true, name: true, slug: true } },
} as const;

function withSortedBulbs<T extends RoomDto>(room: T): T {
  sortByName(room.bulbs);
  return room;
}

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<RoomDto[]> {
    const rooms = await this.prisma.room.findMany({ include: withBulbs });
    return rooms
      .map(withSortedBulbs)
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || compareNames(a.name, b.name),
      );
  }

  async get(ref: string): Promise<RoomDto> {
    const room = await this.prisma.room.findUnique({
      where: parseRef(ref),
      include: withBulbs,
    });
    if (!room) throw new NotFoundException(`Room "${ref}" not found`);
    return withSortedBulbs(room);
  }

  /** The room behind an id or slug, without its bulbs. */
  async resolve(ref: string): Promise<Room> {
    const room = await this.prisma.room.findUnique({ where: parseRef(ref) });
    if (!room) throw new NotFoundException(`Room "${ref}" not found`);
    return room;
  }

  create(dto: CreateRoomDto): Promise<RoomDto> {
    return this.prisma.room.create({
      data: {
        name: dto.name,
        slug: slugFor(dto.slug, dto.name),
        sortOrder: dto.sortOrder,
      },
      include: withBulbs,
    });
  }

  /** Renaming keeps the slug (and so every URL) unless a new slug is given. */
  async update(ref: string, dto: UpdateRoomDto): Promise<RoomDto> {
    const room = await this.resolve(ref);
    return withSortedBulbs(
      await this.prisma.room.update({
        where: { id: room.id },
        data: { name: dto.name, slug: dto.slug, sortOrder: dto.sortOrder },
        include: withBulbs,
      }),
    );
  }

  /** Deletes the room; its bulbs stay, without a room. */
  async remove(ref: string): Promise<void> {
    const room = await this.resolve(ref);
    await this.prisma.$transaction([
      this.prisma.bulb.updateMany({
        where: { roomId: room.id },
        data: { roomId: null },
      }),
      this.prisma.room.delete({ where: { id: room.id } }),
    ]);
  }
}
