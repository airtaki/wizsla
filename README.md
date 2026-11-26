# wizsla

A local REST API for controlling Wiz smart bulbs over the home network.
Built with NestJS; designed to run on a Raspberry Pi and never leave the LAN.

> Version 2 is a ground-up rewrite and is under development on the `develop`
> branch. The original Express implementation is kept under the `v1-express`
> tag. See [docs/PLAN.md](docs/PLAN.md) for the development plan.

## Requirements

- Node.js 24 LTS (see `.nvmrc`; 22.13+ works)
- npm

## Getting started

```bash
npm install                # also generates the Prisma client
cp .env.example .env
npm run db:deploy          # creates data/wizsla.db and applies migrations
npm run build
npm run cli -- apikey:create --name "Admin" --level admin
npm run start:dev
```

The last but one command prints an admin API key once; store it safely.

- Health check (no key needed): `http://localhost:3000/health`
- API documentation (Swagger UI): `http://localhost:3000/docs`

## Authentication

Every endpoint except `/health` and `/docs` needs an API key, sent as
`X-API-Key: <key>` or `Authorization: Bearer <key>`.

Keys have one of three levels, each including the previous one:

| Level     | Allows                             |
| --------- | ---------------------------------- |
| `read`    | Reading state                      |
| `control` | Switching and adjusting bulbs      |
| `admin`   | Managing rooms, bulbs and API keys |

Keys are managed through `/api-keys` (admin) or the CLI:

```bash
npm run cli -- apikey:create --name "Phone" --level control
npm run cli -- apikey:list
npm run cli -- apikey:revoke 3
```

Only a SHA-256 hash of each key is stored. The last active admin key cannot
be revoked.

## Setting up rooms and bulbs

All of this needs an admin key, and is easiest from the Swagger UI at `/docs`.

1. `POST /discovery/scan` finds every bulb on the network and registers the
   new ones, named `Wiz <last 6 digits of the MAC>` and without a room. Run it
   again any time: known bulbs get their current IP, nothing is deleted, and
   registered bulbs that did not answer are listed as `missing`.
2. `POST /rooms` with `{"name": "Étkező"}` creates a room; its slug
   (`etkezo`) is derived from the name and stays when the room is renamed.
3. `POST /bulbs/{ref}/identify` blinks a bulb three times, so you can tell
   which one it is, then `PATCH /bulbs/{ref}` with
   `{"name": "Étkező 1", "roomId": 2}` names it and puts it in a room.

Rooms and bulbs can be addressed by id or slug: `/rooms/2` and
`/rooms/etkezo` are the same. `GET /bulbs?room=none` lists the bulbs that are
not in a room yet.

## Reading state

The service reads every bulb right after startup and then every
`WIZ_POLL_INTERVAL_MS`, and answers from memory:

| Endpoint                 | Returns                                         |
| ------------------------ | ----------------------------------------------- |
| `GET /state`             | Every room with its bulbs, plus unassigned ones |
| `GET /rooms/{ref}/state` | One room, with a summary                        |
| `GET /bulbs/{ref}/state` | One bulb                                        |

Add `?refresh=true` to ask the bulbs first. Each bulb shows `online`, its
last reported `state` (on/off, brightness, colour temperature, RGB or scene,
Wi-Fi signal), `stateAt` and `checkedAt`. An offline bulb keeps its last
known state, so check `online` before trusting it. Summaries count the
bulbs, how many are online and lit, and average the brightness and colour
temperature of the lit ones.

## Controlling lights

A `control` key is enough. The same command body works on one bulb, a room or
every bulb:

| Endpoint                   | Target                       |
| -------------------------- | ---------------------------- |
| `PATCH /bulbs/{ref}/state` | One bulb                     |
| `PATCH /rooms/{ref}/state` | Every enabled bulb of a room |
| `PATCH /state`             | Every enabled bulb           |

```jsonc
{
  "on": true,
  "brightness": 30, // 10–100, or "brightnessDelta": -10
  "colorTemp": 2700, // Kelvin, or "colorTempDelta": -300
  "color": "#FF8800", // or "scene": "sunset" (see GET /scenes)
  "speed": 100, // 10–200, for dynamic scenes
}
```

- Setting anything but `on` also switches the light on; `{"on": false}`
  switches it off and takes nothing else.
- Only one of `color`, `colorTemp` / `colorTempDelta` and `scene` at a time.
  `color` can take `coldWhite` and `warmWhite` (0–255) as well.
- Deltas are added to each bulb's own current value and kept within its
  limits. `colorTempDelta` works in white mode and in static white scenes
  (Warm White, Daylight…), not on a colour or a dynamic scene.
- A room or the whole home always answers 200, with a `status` per bulb
  (`ok`, `offline`, `unsupported`, `failed`), a summary, and each bulb's state
  read back after the command. A single bulb answers 400 if it cannot do it,
  504 if it does not answer, 409 if it is disabled.
- Every command is logged for 90 days: `GET /commands` (admin) shows who sent
  what, when, and how many bulbs carried it out.

## Configuration

Only infrastructure settings come from the environment (see `.env.example`):

| Variable                | Default                 | Description                                         |
| ----------------------- | ----------------------- | --------------------------------------------------- |
| `NODE_ENV`              | `development`           | `development`, `production` or `test`               |
| `HOST`                  | `0.0.0.0`               | Interface to listen on                              |
| `PORT`                  | `3000`                  | HTTP port                                           |
| `LOG_LEVEL`             | `log`                   | `verbose`, `debug`, `log`, `warn`, `error`, `fatal` |
| `DATABASE_URL`          | `file:./data/wizsla.db` | SQLite file, relative to the working directory      |
| `WIZ_BROADCAST_ADDRESS` | `255.255.255.255`       | Where discovery sends its broadcast                 |
| `WIZ_PORT`              | `38899`                 | UDP port of the bulbs                               |
| `WIZ_TIMEOUT_MS`        | `1000`                  | How long to wait for a bulb's answer                |
| `WIZ_RETRIES`           | `2`                     | Resends before a bulb counts as unreachable         |
| `WIZ_DISCOVERY_MS`      | `2000`                  | How long discovery listens for answers              |
| `WIZ_POLL_INTERVAL_MS`  | `20000`                 | Background state polling; `0` turns it off          |

Rooms, bulbs and API keys are stored in the database and managed through the
API. Invalid configuration stops the service at startup.

## Database

SQLite through Prisma. The schema is in `prisma/schema.prisma`.

| Script                                  | Purpose                                           |
| --------------------------------------- | ------------------------------------------------- |
| `npm run db:migrate -- --name <change>` | Create a migration after changing the schema      |
| `npm run db:deploy`                     | Apply pending migrations (also in production)     |
| `npm run db:studio`                     | Browse and edit the data in Prisma Studio (:5555) |

Prisma's update checks are disabled (`CHECKPOINT_DISABLE=1`).

## Scripts

| Script               | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `npm run start:dev`  | Run with live reload                           |
| `npm run build`      | Compile to `dist/`                             |
| `npm run start:prod` | Run the compiled build                         |
| `npm run cli`        | Administration commands (after a build)        |
| `npm run wiz`        | Talk to bulbs directly (after a build)         |
| `npm run lint`       | Lint with oxlint (type-aware)                  |
| `npm run typecheck`  | Type-check sources and tests                   |
| `npm test`           | Unit tests (Vitest)                            |
| `npm run test:e2e`   | End-to-end HTTP tests, on a throwaway database |
| `npm run format`     | Format with Prettier                           |

## Branches

- `develop`: day-to-day development.
- `main`: production; this is what runs on the Raspberry Pi.

## License

MIT
