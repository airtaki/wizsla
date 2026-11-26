import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RequireLevel } from '../auth/decorators.js';
import { BulbDto, CreateBulbDto, UpdateBulbDto } from './bulbs.dto.js';
import { BulbsService } from './bulbs.service.js';

const BulbRef = () =>
  ApiParam({
    name: 'ref',
    description: 'Bulb id or slug, e.g. 4 or "nappali-1"',
  });

@ApiTags('Bulbs')
@Controller('bulbs')
export class BulbsController {
  constructor(private readonly bulbs: BulbsService) {}

  @RequireLevel('read')
  @ApiQuery({
    name: 'room',
    required: false,
    description: 'Room id or slug; "none" lists bulbs without a room',
  })
  @Get()
  list(@Query('room') room?: string): Promise<BulbDto[]> {
    return this.bulbs.list(room);
  }

  @RequireLevel('read')
  @BulbRef()
  @Get(':ref')
  get(@Param('ref') ref: string): Promise<BulbDto> {
    return this.bulbs.get(ref);
  }

  /** Registers a bulb by IP. Usually discovery does this instead. */
  @RequireLevel('admin')
  @Post()
  create(@Body() dto: CreateBulbDto): Promise<BulbDto> {
    return this.bulbs.create(dto);
  }

  @RequireLevel('admin')
  @BulbRef()
  @Patch(':ref')
  update(
    @Param('ref') ref: string,
    @Body() dto: UpdateBulbDto,
  ): Promise<BulbDto> {
    return this.bulbs.update(ref, dto);
  }

  @RequireLevel('admin')
  @BulbRef()
  @Delete(':ref')
  @HttpCode(204)
  remove(@Param('ref') ref: string): Promise<void> {
    return this.bulbs.remove(ref);
  }

  /** Blinks the bulb three times, then leaves it as it was. */
  @RequireLevel('control')
  @BulbRef()
  @Post(':ref/identify')
  @HttpCode(204)
  identify(@Param('ref') ref: string): Promise<void> {
    return this.bulbs.identify(ref);
  }
}
