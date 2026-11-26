import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { RequireLevel } from '../auth/decorators.js';
import { CreateRoomDto, RoomDto, UpdateRoomDto } from './rooms.dto.js';
import { RoomsService } from './rooms.service.js';

const RoomRef = () =>
  ApiParam({
    name: 'ref',
    description: 'Room id or slug, e.g. 3 or "nappali"',
  });

@ApiTags('Rooms')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  /** Every room with its bulbs, in display order. */
  @RequireLevel('read')
  @Get()
  list(): Promise<RoomDto[]> {
    return this.rooms.list();
  }

  @RequireLevel('read')
  @RoomRef()
  @Get(':ref')
  get(@Param('ref') ref: string): Promise<RoomDto> {
    return this.rooms.get(ref);
  }

  @RequireLevel('admin')
  @Post()
  create(@Body() dto: CreateRoomDto): Promise<RoomDto> {
    return this.rooms.create(dto);
  }

  @RequireLevel('admin')
  @RoomRef()
  @Patch(':ref')
  update(
    @Param('ref') ref: string,
    @Body() dto: UpdateRoomDto,
  ): Promise<RoomDto> {
    return this.rooms.update(ref, dto);
  }

  /** Deletes the room. Its bulbs are kept, without a room. */
  @RequireLevel('admin')
  @RoomRef()
  @Delete(':ref')
  @HttpCode(204)
  remove(@Param('ref') ref: string): Promise<void> {
    return this.rooms.remove(ref);
  }
}
