# mantenimiento-equipos

Equipment maintenance app for an ice-cream shop: track equipment, maintenance events and loan
agreements.

## Structure

pnpm workspace monorepo, TypeScript everywhere.

```text
.
├── apps/
│   ├── api/             # @mantenimiento/api: Express 5 + Prisma (PostgreSQL) REST API
│   └── web/             # @mantenimiento/web: React + Vite + Tailwind CSS 4 PWA
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
| `pnpm docker:up`    | Build and start the Docker stack (detached)   |
| `pnpm docker:down`  | Stop the Docker stack (keeps the database)    |

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

## Web (`apps/web`)

Mobile-first React PWA (Vite, Tailwind CSS 4, `vite-plugin-pwa`). Features live under
`src/features/<feature>/` split into a container (hook that fetches) and a presentational
component; API calls go through `src/shared/api/`, validated with the shared zod schemas. The dev
server proxies `/api` to the API at `http://localhost:3000`.

| Command                                    | What it does                       |
| ------------------------------------------ | ---------------------------------- |
| `pnpm --filter @mantenimiento/web dev`     | Start the Vite dev server          |
| `pnpm --filter @mantenimiento/web build`   | Type-check and build into `dist`   |
| `pnpm --filter @mantenimiento/web preview` | Serve the production build locally |

Run a script in one package with a filter, for example:

```sh
pnpm --filter @mantenimiento/shared test
```

## Docker

`docker-compose.yml` runs the whole stack locally. Images are built from the repository root
(`apps/api/Dockerfile`, `apps/web/Dockerfile`).

| Service | Image                                  | Port                                        |
| ------- | -------------------------------------- | ------------------------------------------- |
| `db`    | `postgres:18-alpine`, volume `db-data` | `127.0.0.1:${DB_PORT:-5432}`                |
| `api`   | Node 26 Alpine, non-root               | `3000`, internal only                       |
| `web`   | `nginx-unprivileged`, serves the PWA   | `${WEB_PORT:-8080}`, proxies `/api/` to api |

```sh
cp .env.example .env   # then set a real POSTGRES_PASSWORD (and the same one in DATABASE_URL)
pnpm docker:up         # docker compose up --build -d
curl http://localhost:8080/api/health
pnpm docker:down       # add -v (docker compose down -v) to also delete the database volume
```

Variables (`.env`, read by Compose; never commit it):

| Variable                                            | Purpose                                                       |
| --------------------------------------------------- | ------------------------------------------------------------- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database credentials and name created on first start          |
| `DATABASE_URL`                                      | API connection string; host is the service name `db`          |
| `WEB_PORT`                                          | Host port for the web app (default `8080`)                    |
| `DB_PORT`                                           | Host port for PostgreSQL, bound to localhost (default `5432`) |

Every service has a health check (`pg_isready`, `GET /api/health`, the nginx root); `api` waits
for a healthy `db` and `web` for a healthy `api`. nginx sends `no-cache` for `index.html`, the
service worker and the manifest, and caches the content-hashed files under `/assets/` for a year.
