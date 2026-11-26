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
npm install
cp .env.example .env
npm run start:dev
```

The service answers on `http://localhost:3000/health`.

## Configuration

Only infrastructure settings come from the environment (see `.env.example`):

| Variable    | Default       | Description                                         |
| ----------- | ------------- | --------------------------------------------------- |
| `NODE_ENV`  | `development` | `development`, `production` or `test`               |
| `HOST`      | `0.0.0.0`     | Interface to listen on                              |
| `PORT`      | `3000`        | HTTP port                                           |
| `LOG_LEVEL` | `log`         | `verbose`, `debug`, `log`, `warn`, `error`, `fatal` |

Rooms, bulbs and API keys are stored in the database and managed through the
API. Invalid configuration stops the service at startup.

## Scripts

| Script               | Purpose                       |
| -------------------- | ----------------------------- |
| `npm run start:dev`  | Run with live reload          |
| `npm run build`      | Compile to `dist/`            |
| `npm run start:prod` | Run the compiled build        |
| `npm run lint`       | Lint with oxlint (type-aware) |
| `npm run typecheck`  | Type-check sources and tests  |
| `npm test`           | Unit tests (Vitest)           |
| `npm run test:e2e`   | End-to-end HTTP tests         |
| `npm run format`     | Format with Prettier          |

## Branches

- `develop`: day-to-day development.
- `main`: production; this is what runs on the Raspberry Pi.

## License

MIT
