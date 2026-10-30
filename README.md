# mantenimiento-equipos

Equipment maintenance app for an ice-cream shop: track equipment, maintenance events and loan
agreements.

## Structure

pnpm workspace monorepo, TypeScript everywhere.

```text
.
├── apps/
│   └── api/             # @mantenimiento/api: Express 5 + Prisma (PostgreSQL) REST API
├── packages/
│   └── shared/          # @mantenimiento/shared: zod schemas and types shared by API and web
├── eslint.config.js     # ESLint flat config for the whole workspace
├── tsconfig.base.json   # Strict compiler options every package extends
└── pnpm-workspace.yaml  # Workspace globs: apps/*, packages/*
```

## Prerequisites

- Node.js 26 (see `.nvmrc`; `nvm use` picks it up)
- pnpm 11 (pinned through `packageManager`; `corepack enable` installs the right version)

## Getting started

```sh
pnpm install
```

## Commands

Run from the repository root. Workspace scripts run recursively and skip packages that do not
define them.

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `pnpm lint`         | Lint the whole workspace with ESLint          |
| `pnpm typecheck`    | Type-check every package                      |
| `pnpm test`         | Run every package's tests                     |
| `pnpm build`        | Build every package                           |
| `pnpm format`       | Format all files with Prettier                |
| `pnpm format:check` | Check formatting without writing (used in CI) |

## API (`apps/api`)

Hexagonal modules under `src/modules/<module>/{domain,application,infrastructure}`; `src/app.ts`
builds the Express app and `src/server.ts` starts it. Copy `apps/api/.env.example` to
`apps/api/.env` before running it. The Prisma client is generated on `pnpm install`
(`prisma generate`, no database needed).

| Command                                     | What it does                            |
| ------------------------------------------- | --------------------------------------- |
| `pnpm --filter @mantenimiento/api dev`      | Start the API with reload (`tsx watch`) |
| `pnpm --filter @mantenimiento/api start`    | Run the built API from `dist`           |
| `pnpm --filter @mantenimiento/api generate` | Regenerate the Prisma client            |

Health check: `GET /api/health` returns `{ "status": "ok" }`.

Run a script in one package with a filter, for example:

```sh
pnpm --filter @mantenimiento/shared test
```
