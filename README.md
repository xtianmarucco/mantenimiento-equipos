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

| Command                 | What it does                                                    |
| ----------------------- | --------------------------------------------------------------- |
| `pnpm lint`             | Lint the whole workspace with ESLint                            |
| `pnpm typecheck`        | Type-check every package                                        |
| `pnpm test`             | Run every package's tests                                       |
| `pnpm test:integration` | API integration tests against PostgreSQL (needs `DATABASE_URL`) |
| `pnpm build`            | Build every package                                             |
| `pnpm format`           | Format all files with Prettier                                  |
| `pnpm format:check`     | Check formatting without writing (used in CI)                   |
| `pnpm docker:up`        | Build and start the Docker stack (detached)                     |
| `pnpm docker:down`      | Stop the Docker stack (keeps the database)                      |

## API (`apps/api`)

Hexagonal modules under `src/modules/<module>/{domain,application,infrastructure}`; `src/app.ts`
builds the Express app and `src/server.ts` starts it. Copy `apps/api/.env.example` to
`apps/api/.env` before running it. The Prisma client is generated on `pnpm install`
(`prisma generate`, no database needed).

| Command                                       | What it does                                             |
| --------------------------------------------- | -------------------------------------------------------- |
| `pnpm --filter @mantenimiento/api dev`        | Start the API with reload (`tsx watch`)                  |
| `pnpm --filter @mantenimiento/api start`      | Run the built API from `dist`                            |
| `pnpm --filter @mantenimiento/api generate`   | Regenerate the Prisma client                             |
| `pnpm --filter @mantenimiento/api db:migrate` | Create and apply a migration, regenerate the client      |
| `pnpm --filter @mantenimiento/api db:deploy`  | Apply pending migrations (no prompts)                    |
| `pnpm --filter @mantenimiento/api db:seed`    | Load sample locations, equipment and events (idempotent) |
| `pnpm --filter @mantenimiento/api db:reset`   | Drop the database, re-apply migrations and seed          |

Health check: `GET /api/health` returns `{ "status": "ok" }`.

| Endpoint                         | What it does                                                             |
| -------------------------------- | ------------------------------------------------------------------------ |
| `GET /api/locations`             | List locations, sorted by name                                           |
| `GET /api/locations/:id`         | One location                                                             |
| `POST /api/locations`            | Create a location (201)                                                  |
| `PATCH /api/locations/:id`       | Change some fields; `null` clears an optional one                        |
| `GET /api/equipment`             | List equipment, sorted by name; filters `status`, `locationId`, `type`   |
| `GET /api/equipment/:id`         | One piece of equipment (retired too)                                     |
| `POST /api/equipment`            | Create equipment (201); `status` defaults to `OPERATIONAL`               |
| `PATCH /api/equipment/:id`       | Change some details; `null` clears an optional one (not status/location) |
| `GET /api/equipment/:id/events`  | History of one item, newest first (`occurredOn`, then `createdAt`)       |
| `POST /api/equipment/:id/events` | Record an event (201): `{ event, equipment }` after the event's effect   |

Bodies, ids and query strings are validated with the `packages/shared` schemas. Errors are JSON
`{ "error": { "message", "issues"? } }` (`errorResponseSchema`): 400 for an invalid body, id or
query (`issues` lists each field path), 404 for an unknown id, 409 for an equipment `code` already
in use. Locations cannot be deleted (equipment references them). `createApp` takes its
repositories as arguments: `server.ts` passes Prisma ones, tests pass in-memory ones, so tests
never open a database connection.

Equipment rules:

- **Retired equipment is hidden by default.** `GET /api/equipment` without `status` leaves out
  `RETIRED` items; `?status=RETIRED` lists only those. Filters combine with AND.
- **Status and location change only through events.** Create sets the initial ones; after that,
  `POST /:id/events` is the only way to change them, so the history always explains the current
  status and location. `PATCH` answers 400 with an issue at `status` or `locationId` when the body
  carries either (other unknown keys are dropped, as in every body).
- **No DELETE.** A `RETIREMENT` (or `REPLACEMENT`) event retires the item instead, and `RETIRED`
  is final: retired equipment accepts no further events.
- **`code`** is trimmed and uppercased before the format check (`eq-0042` → `EQ-0042`), so a
  duplicate is detected after normalizing.
- **`locationId`** (on create) must name an existing location: otherwise 400 with an issue at
  `locationId`, also if the location disappears between the check and the write (foreign key).
- **Warranty** cannot end before the purchase date. A `PATCH` that sends only one of the dates is
  checked against the stored value of the other; the issue is reported at `warrantyUntil`.
- `purchaseDate` and `warrantyUntil` are calendar dates (`YYYY-MM-DD`), timestamps are ISO 8601
  UTC.

Equipment events (append-only history; never edited or deleted, a correction is a new event). The
body is discriminated by `type`; `occurredOn` (`YYYY-MM-DD`) and `description` are always required.
The event and its effect on the equipment are written in one transaction.

| `type`        | Extra fields                                     | Allowed from                  | Effect                     |
| ------------- | ------------------------------------------------ | ----------------------------- | -------------------------- |
| `MAINTENANCE` | optional `technician`, `cost`                    | any non-retired status        | none                       |
| `BREAKDOWN`   | `resultingStatus` (`IN_REPAIR`/`OUT_OF_SERVICE`) | any non-retired status        | status → `resultingStatus` |
| `REPAIR`      | optional `technician`, `cost`                    | `IN_REPAIR`, `OUT_OF_SERVICE` | status → `OPERATIONAL`     |
| `TRANSFER`    | `toLocationId` (another, existing location)      | any non-retired status        | location → `toLocationId`  |
| `REPLACEMENT` | optional `replacementEquipmentId`                | any non-retired status        | status → `RETIRED`         |
| `RETIREMENT`  | none (the description is the reason)             | any non-retired status        | status → `RETIRED`         |

- **Rules** answer 400 with an issue at the field: `RETIRED` is final (any event, issue at
  `type`); an invalid transition (at `type`); `occurredOn` after today or before the purchase
  date (at `occurredOn`); a transfer to the current or an unknown location (at `toLocationId`);
  replacement equipment that does not exist, is the same item or is retired (at
  `replacementEquipmentId`). Unknown equipment answers 404.
- **Today** is the API process's local date (`TZ`); `createApp` accepts a `today` function for
  tests.
- `cost` is ARS, non-negative, at most two decimals; a transfer records `fromLocationId` (where
  the item was).
- **Known race:** the rules are checked against the equipment as read before the write, without a
  lock, so two events sent at the same time can both pass against the same status (for example two
  retirements). Accepted while there is a single owner and no authentication.

### Warranty check before migrating existing data

Migration `20261101210000_equipment_warranty_check` adds the CHECK constraint
`equipment_warranty_after_purchase_check` (`warranty_until IS NULL OR warranty_until >=
purchase_date`). On a database that already holds equipment, `prisma migrate deploy` fails with
SQLSTATE `23514` if any row breaks the rule, so look for those rows first:

```sql
SELECT id, code, purchase_date, warranty_until
FROM equipment
WHERE warranty_until < purchase_date
ORDER BY code;
```

Fix each row with its real dates (from the invoice or warranty card), for example
`UPDATE equipment SET warranty_until = '2027-01-15' WHERE code = 'EQ-0042';`. When the
warranty end is unknown, clear it instead: `UPDATE equipment SET warranty_until = NULL WHERE
warranty_until < purchase_date;`. Rerun the query until it returns no rows, then deploy. If
the deploy already failed, Prisma records the migration as failed: after fixing the data, run
`prisma migrate resolve --rolled-back 20261101210000_equipment_warranty_check` and deploy again.

Integration tests (`*.integration.test.ts`, `vitest.integration.config.ts`) run the Prisma
repositories against a real PostgreSQL. `pnpm test` excludes them and needs no database. Each
repository port has a shared contract suite (for example `location-repository.contract.ts`) that
runs against the in-memory adapter in `pnpm test` and against the Prisma adapter here, so the
fakes used by the other tests cannot drift from production. `pnpm test:integration` fails at once
when `DATABASE_URL` is missing or names a database that does not end in `_test` (every table is
truncated before each test), then applies the migrations with `prisma migrate deploy`. Helpers
for new suites live in `src/test/integration/` (`createTestPrismaClient`, `truncateAllTables`).
Locally, with throwaway values:

```sh
export POSTGRES_USER=test POSTGRES_PASSWORD=test-only-password POSTGRES_DB=mantenimiento_test
export DATABASE_URL=postgresql://test:test-only-password@localhost:5432/mantenimiento_test
docker compose up -d --wait db
pnpm test:integration
docker compose down -v
```

Location and equipment lists are ordered by name in Spanish alphabetical order, then by id. `locations.name` and
`equipment.name` use the ICU collation `es_natural` (created by a migration), so the order does not
depend on the image's libc: accents and case do not push a name to the end ("Álamo" sits with
"Alameda", lowercase interleaves with uppercase) and "ñ" follows "n". The in-memory adapters
mirror it with `Intl.Collator('es')` (`src/shared/infrastructure/spanish-name-order.ts`), and the
contract suites fail if the two disagree.

### Collation version

`es_natural` sorts with the ICU library inside the PostgreSQL image (icu-libs 78.1 in
`postgres:18.6-alpine3.24`), and PostgreSQL records the collation version when the migration
creates it. The image tag pins the PostgreSQL minor and the Alpine release, which fixes the ICU
major; an Alpine security rebuild under the same tag can still ship a patched icu-libs, so the
tag is not a byte-for-byte pin. When you change the tag, or PostgreSQL logs a "collation version
mismatch" warning, check the database:

```sql
SELECT collname, collversion, pg_collation_actual_version(oid)
FROM pg_collation WHERE collname = 'es_natural';
```

If the two versions differ, sort order may have changed: rebuild every index that uses the
collation (`REINDEX INDEX ...`, or `REINDEX DATABASE` when unsure), then record the new version
with `ALTER COLLATION es_natural REFRESH VERSION;`. Today no index uses `es_natural`, so only the
order of lists can change; also rerun `pnpm test:integration`, since the in-memory adapter
follows Node's bundled ICU and must keep agreeing with the image's.

Database: models live in `prisma/schema.prisma` (tables and columns in snake_case), migrations
in `prisma/migrations` and the development seed in `prisma/seed.ts` (two own stores, two
third-party kiosks and equipment in every status). The `db:*` scripts need `DATABASE_URL`; with
the Compose database running, point it at `localhost:${DB_PORT}` instead of the `db` host.
`db:migrate` uses `prisma migrate dev`, which in Prisma 7 no longer regenerates the client, so the
script runs `prisma generate` after it.

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

| Service   | Image                                        | Port                                         |
| --------- | -------------------------------------------- | -------------------------------------------- |
| `db`      | `postgres:18.6-alpine3.24`, volume `db-data` | `127.0.0.1:${DB_PORT:-5432}`                 |
| `migrate` | `apps/api/Dockerfile` target `migrate`       | none; runs `prisma migrate deploy` and exits |
| `api`     | Node 26 Alpine, non-root                     | `3000`, internal only                        |
| `web`     | `nginx-unprivileged`, serves the PWA         | `${WEB_PORT:-8080}`, proxies `/api/` to api  |

```sh
cp .env.example .env   # then set a real POSTGRES_PASSWORD (and the same one in DATABASE_URL)
pnpm docker:up         # docker compose up --build -d
docker compose run --rm migrate prisma db seed   # optional: load sample data
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

Migrations run as a one-shot `migrate` job (`prisma migrate deploy`) before the API starts:
`api` waits for it to exit successfully, so a failed migration stops the API from starting
against a schema it does not expect. The job uses the `migrate` stage of `apps/api/Dockerfile`, which
reuses the build stage with the full install (Prisma CLI, schema engine, `tsx`); the API runtime
image stays without the CLI, which would add about 235 MB to it.

Every service has a health check (`pg_isready`, `GET /api/health`, the nginx root); `api` waits
for a healthy `db` and `web` for a healthy `api`. nginx sends `no-cache` for `index.html`, the
service worker and the manifest, and caches the content-hashed files under `/assets/` for a year.
The security headers live in `apps/web/nginx/security-headers.conf`; every nginx `location` that
adds its own header must include that file again, because nginx then stops inheriting them.

## CI

`.github/workflows/ci.yml` runs on every push and pull request, with read-only repository access.
Actions are pinned to commit SHAs, and checkout does not keep the token in the git config.
A newer run on the same branch or pull request cancels the older one.

| Job           | What it does                                                                                                                                                                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checks`      | `pnpm install --frozen-lockfile`, then `lint`, `typecheck`, `test`, `build` and `format:check` on Node from `.nvmrc`                                                                                                                                                                                                                    |
| `integration` | Starts a `postgres:18.6-alpine3.24` service container with throwaway credentials and runs `pnpm test:integration` (migrations, then the integration suites)                                                                                                                                                                             |
| `docker`      | After `checks` passes, builds the `api`, `migrate` and `web` images (not pushed, layers cached in the GitHub Actions cache), then starts the compose stack with throwaway credentials (migrations run first), waits for every service to be healthy, runs the seed, requests `/api/health` and `/` through nginx, and removes the stack |

Run the same checks locally before pushing:

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check
```
