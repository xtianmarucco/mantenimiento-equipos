# Feature: equipment-catalog

## Objective

Let the owner register and manage the shop's equipment and the places where it lives (own stores and third-party kiosks that receive freezers on loan), from the API and a mobile-first web UI.

## Problem / Why

The scaffold has no domain yet. Every later feature (maintenance/breakdown/replacement/transfer events, loan agreements, QR scanning) needs a stable equipment record with a unique code and a current location.

## Scope

- `Location`: name, kind (`OWN_STORE` | `THIRD_PARTY`), optional address, contact name, phone; timestamps.
- `Equipment`: unique internal `code` (QR payload, e.g. `EQ-0042`), name, type (freezer, refrigerator, display case, ice-cream machine, other), brand, model, optional serial number, purchase date, optional warranty-until date, status (`OPERATIONAL` | `IN_REPAIR` | `OUT_OF_SERVICE` | `RETIRED`), current location (required relation), notes; timestamps.
- Shared zod schemas and types for both (create, update, response, list filters).
- Prisma models, first migration, seed data; compose runs `prisma migrate deploy` before the api starts.
- API: list/get/create/update for locations and equipment; equipment list filters by status, location and type; "retire" sets status `RETIRED` (no hard delete); duplicate code → 409.
- Web: equipment list with status/location filters, equipment detail, create/edit form; minimal locations list + create/edit.

Out of scope: authentication/roles, QR generation/scanning, events (maintenance, breakdown, replacement, transfer), loan agreements (comodatos), file uploads.

## Constraints

- Hexagonal module layout in the api (`src/modules/<module>/{domain,application,infrastructure}`), same as `health`.
- Validation schemas live in `packages/shared` and are reused by api and web.
- No ownership field: all equipment belongs to the owner (user decision 2026-11-01).
- Generated technical artifacts in English; test-first where a runnable deterministic test applies.

## Acceptance criteria

- `pnpm lint|typecheck|test|build|format:check` pass from the root.
- `docker compose up --build` applies migrations; seeded equipment and locations are served by the api.
- API endpoints validate input with the shared schemas, return 400 on invalid input, 404 on missing ids, 409 on duplicate equipment code; covered by tests.
- Web list, detail and form work at phone width and are covered by component tests.

## Tasks

- [ ] T1 `packages/shared`: zod schemas + types for Location and Equipment (enums, create, update, response, list query) with unit tests.
- [ ] T2 `apps/api` persistence: Prisma models + first migration + seed; compose/api image runs `prisma migrate deploy` on start; README.
- [ ] T3 `apps/api` locations module: domain, use cases, Prisma repository, router (`/api/locations`), tests with in-memory repository and HTTP tests.
- [ ] T4 `apps/api` equipment module: domain, use cases (list with filters, get, create, update, retire), Prisma repository, router (`/api/equipment`), 409 on duplicate code, tests.
- [ ] T5 `apps/web` routing + equipment list page with status/location filters (mobile-first), api client functions, tests.
- [ ] T6 `apps/web` equipment detail + create/edit form (shared zod validation, location select), tests.
- [ ] T7 `apps/web` locations list + create/edit form, tests.

## Routing

- Route: delegated direct per task (writer trigger: 2+ non-trivial files per task).

## Delivery

- Forecast: ~1800 authored changed lines (migration SQL and generated Prisma client excluded) — exceeds the ~400 budget.
- Delivery strategy: `ask-on-risk` (default). Chain strategy: `feature-branch-chain` (user decision 2026-11-01).
- Slices (each child PR targets its immediate parent branch):
  1. `feat/equipment-catalog-01-persistence` → T1 + T2
  2. `feat/equipment-catalog-02-locations-api` → T3
  3. `feat/equipment-catalog-03-equipment-api` → T4
  4. `feat/equipment-catalog-04-web-list` → T5
  5. `feat/equipment-catalog-05-web-forms` → T6 + T7
- Base: `feat/monorepo-scaffold-04-delivery` (scaffold not merged to `main` yet). Tracker branch: `feat/equipment-catalog`.

## Progress

- 2026-11-01: design agreed with the user; feature document created on `feat/equipment-catalog`.

## Next step

T1 on `feat/equipment-catalog-01-persistence`.
