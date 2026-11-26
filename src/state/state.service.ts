import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { bulbInclude, BulbsService } from '../bulbs/bulbs.service.js';
import { sortByName } from '../common/sort.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Bulb } from '../generated/prisma/client.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { WizError } from '../wiz/errors.js';
import type { BulbState } from '../wiz/protocol.js';
import { findScene } from '../wiz/scenes.js';
import { WizClient } from '../wiz/wiz-client.js';
import type {
  BulbStateDto,
  LightStateDto,
  RoomStateDto,
  StateOverviewDto,
  StateSummaryDto,
} from './state.dto.js';

export type BulbRow = Bulb & {
  room: { id: number; name: string; slug: string } | null;
};

/** The outcome of the last check of one bulb. */
interface Reading {
  online: boolean;
  state: BulbState | null;
  stateAt: Date | null;
  checkedAt: Date;
  error?: string;
}

/** `lastSeenAt` in the database is refreshed at most this often per bulb. */
const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60_000;

/**
 * Keeps the last known state of every bulb in memory. The poller refreshes
 * it in the background; requests answer from it, and can ask for a fresh
 * reading with `refresh`.
 */
@Injectable()
export class StateService implements OnModuleDestroy {
  private readonly logger = new Logger(StateService.name);
  private readonly readings = new Map<number, Reading>();
  /** Checks under way, so one bulb is never asked twice at the same time. */
  private readonly inFlight = new Map<number, Promise<Reading>>();
  private closing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wiz: WizClient,
    private readonly rooms: RoomsService,
    private readonly bulbs: BulbsService,
  ) {}

  onModuleDestroy(): void {
    this.closing = true;
  }

  async overview(refresh = false): Promise<StateOverviewDto> {
    const [rooms, bulbs] = await Promise.all([
      this.rooms.list(),
      this.loadBulbs(),
    ]);
    await this.ensureChecked(bulbs, refresh);

    const states = bulbs.map((bulb) => this.toDto(bulb));
    return {
      summary: summarize(states),
      rooms: rooms.map((room) =>
        roomState(
          room,
          states.filter((s) => s.room?.id === room.id),
        ),
      ),
      unassigned: states.filter((s) => s.room === null),
    };
  }

  async room(ref: string, refresh = false): Promise<RoomStateDto> {
    const room = await this.rooms.resolve(ref);
    const bulbs = await this.loadBulbs({ roomId: room.id });
    await this.ensureChecked(bulbs, refresh);
    return roomState(
      room,
      bulbs.map((bulb) => this.toDto(bulb)),
    );
  }

  async bulb(ref: string, refresh = false): Promise<BulbStateDto> {
    const { id } = await this.bulbs.get(ref);
    const [bulb] = await this.loadBulbs({ id });
    await this.ensureChecked([bulb], refresh);
    return this.toDto(bulb);
  }

  /** Reads every enabled bulb; called by the poller. */
  async refreshAll(): Promise<void> {
    const bulbs = await this.loadBulbs();
    const known = new Set(bulbs.map((b) => b.id));
    for (const id of this.readings.keys()) {
      if (!known.has(id)) this.readings.delete(id);
    }
    await this.ensureChecked(bulbs, true);
  }

  /**
   * Reads a bulb right after a command. A check already under way may have
   * started before the command, so it is waited for and a new one is made.
   */
  async readAfterCommand(bulb: BulbRow): Promise<BulbStateDto> {
    await this.inFlight.get(bulb.id);
    await this.check(bulb);
    return this.toDto(bulb);
  }

  /** A fresh reading of the bulb, or `null` if it does not answer. */
  async freshState(bulb: BulbRow): Promise<BulbState | null> {
    const reading = await this.check(bulb);
    return reading.online ? reading.state : null;
  }

  /** Records that a command could not reach the bulb. */
  markUnreachable(bulb: BulbRow, error: string): void {
    this.readings.set(
      bulb.id,
      this.failed(this.readings.get(bulb.id), new Date(), error),
    );
  }

  /** The bulb as the state endpoints show it, from the last reading. */
  describe(bulb: BulbRow): BulbStateDto {
    return this.toDto(bulb);
  }

  /** Bulbs with their room, in name order. */
  loadBulbs(where: { id?: number; roomId?: number } = {}): Promise<BulbRow[]> {
    return this.prisma.bulb
      .findMany({ where, include: bulbInclude })
      .then((rows) => sortByName(rows as BulbRow[]));
  }

  /**
   * Checks the enabled bulbs that have no reading yet, or all of them when
   * `refresh` is set. Disabled bulbs are never asked.
   */
  private async ensureChecked(
    bulbs: BulbRow[],
    refresh: boolean,
  ): Promise<void> {
    await Promise.all(
      bulbs
        .filter((b) => b.enabled && (refresh || !this.readings.has(b.id)))
        .map((b) => this.check(b)),
    );
  }

  private check(bulb: BulbRow): Promise<Reading> {
    const running = this.inFlight.get(bulb.id);
    if (running) return running;

    const check = this.read(bulb).finally(() => this.inFlight.delete(bulb.id));
    this.inFlight.set(bulb.id, check);
    return check;
  }

  private async read(bulb: BulbRow): Promise<Reading> {
    const previous = this.readings.get(bulb.id);
    const checkedAt = new Date();
    let reading: Reading;

    try {
      const state = await this.wiz.getPilot({ ip: bulb.ip, port: bulb.port });
      if (state.mac.toLowerCase() === bulb.mac) {
        reading = { online: true, state, stateAt: checkedAt, checkedAt };
        await this.touchLastSeen(bulb, checkedAt);
      } else {
        reading = this.failed(
          previous,
          checkedAt,
          `A different bulb (${state.mac}) answers at ${bulb.ip}; run discovery to update the address`,
        );
      }
    } catch (error) {
      if (!(error instanceof WizError)) throw error;
      reading = this.failed(previous, checkedAt, error.message);
    }

    if (previous?.online !== reading.online && previous !== undefined) {
      if (reading.online) this.logger.log(`${bulb.name} is back online`);
      else this.logger.warn(`${bulb.name} went offline: ${reading.error}`);
    }
    this.readings.set(bulb.id, reading);
    return reading;
  }

  private failed(
    previous: Reading | undefined,
    checkedAt: Date,
    error: string,
  ): Reading {
    return {
      online: false,
      state: previous?.state ?? null,
      stateAt: previous?.stateAt ?? null,
      checkedAt,
      error,
    };
  }

  private async touchLastSeen(bulb: BulbRow, now: Date): Promise<void> {
    if (this.closing) return;
    const last = bulb.lastSeenAt?.getTime() ?? 0;
    if (now.getTime() - last < LAST_SEEN_WRITE_INTERVAL_MS) return;
    try {
      await this.prisma.bulb.update({
        where: { id: bulb.id },
        data: { lastSeenAt: now },
      });
      bulb.lastSeenAt = now;
    } catch {
      // Deleted meanwhile, or shutting down: the reading still counts.
    }
  }

  private toDto(bulb: BulbRow): BulbStateDto {
    const reading = this.readings.get(bulb.id);
    return {
      id: bulb.id,
      name: bulb.name,
      slug: bulb.slug,
      room: bulb.room,
      enabled: bulb.enabled,
      online: reading?.online ?? null,
      state: reading?.state ? toLightState(reading.state) : null,
      stateAt: reading?.stateAt ?? null,
      checkedAt: reading?.checkedAt ?? null,
      ...(reading?.error && { error: reading.error }),
    };
  }
}

export function toLightState(state: BulbState): LightStateDto {
  const scene =
    state.sceneId === undefined ? undefined : findScene(state.sceneId);
  return {
    on: state.on,
    mode: state.mode,
    brightness: state.brightness,
    colorTemp: state.colorTemp,
    color: state.color,
    coldWhite: state.coldWhite,
    warmWhite: state.warmWhite,
    scene: scene && { id: scene.id, name: scene.name, slug: scene.slug },
    speed: state.speed,
    rssi: state.rssi,
  };
}

export function summarize(bulbs: BulbStateDto[]): StateSummaryDto {
  const online = bulbs.filter((b) => b.online);
  const lit = online.filter((b) => b.state?.on);
  return {
    total: bulbs.length,
    online: online.length,
    on: lit.length,
    brightness: average(lit.map((b) => b.state?.brightness)),
    // White mode and static white scenes; dynamic scenes report no Kelvin.
    colorTemp: average(lit.map((b) => b.state?.colorTemp)),
  };
}

function roomState(
  room: { id: number; name: string; slug: string },
  bulbs: BulbStateDto[],
): RoomStateDto {
  return {
    id: room.id,
    name: room.name,
    slug: room.slug,
    summary: summarize(bulbs),
    bulbs,
  };
}

function average(values: (number | undefined)[]): number | null {
  const numbers = values.filter((v): v is number => v !== undefined);
  if (numbers.length === 0) return null;
  return Math.round(numbers.reduce((sum, v) => sum + v, 0) / numbers.length);
}
