# Feature: equipment-events

## Objective

Record an append-only history of events per equipment (maintenance, breakdown, repair, transfer, replacement, retirement) and make those events the only way to change an equipment's status and location, from the API and the mobile-first web UI.

## Problem / Why

Today status and location are free PATCH fields and "retire" only flips the status: nothing records what happened, when, or why. The owner needs a maintenance history per equipment, and the history must always explain the current status and location (user decision 2026-11-11: events drive equipment state).

## Scope

- `EquipmentEvent`: id, equipment, type, occurred-on date, description, type-specific fields, created-at.
- Event types and effects (user decision 2026-11-11):

  | Type          | Effect on equipment                                   | Extra fields                       |
  | ------------- | ----------------------------------------------------- | ---------------------------------- |
  | `MAINTENANCE` | none                                                  | optional technician, optional cost |
  | `BREAKDOWN`   | status → `IN_REPAIR` or `OUT_OF_SERVICE` (user picks) | resulting status                   |
  | `REPAIR`      | status → `OPERATIONAL`                                | optional technician, optional cost |
  | `TRANSFER`    | location → destination (status unchanged)             | destination location (must differ) |
  | `REPLACEMENT` | status → `RETIRED`                                    | optional replacement equipment     |
  | `RETIREMENT`  | status → `RETIRED`                                    | reason (the description)           |

- History is append-only: events are never edited or deleted; a correction is a new event. `RETIRED` is final: no further events.
- Status and location change only through events (user decision 2026-11-11): removed from the equipment PATCH and the edit form; `POST /api/equipment/:id/retire` is replaced by a `RETIREMENT` event. Create still sets the initial status and location.
- API: `GET /api/equipment/:id/events` (newest first) and `POST /api/equipment/:id/events`; the event and the equipment change are written atomically.
- Web: history section on the equipment detail page, "Registrar evento" form with type-specific fields, "Dar de baja" becomes a `RETIREMENT` event.
- Seed: sample events consistent with the seeded statuses.

Out of scope: authentication/roles ("who" is not recorded until roles exist), QR, loan agreements (comodatos), file/photo uploads, a global events list, editing or deleting events.

## Defaults (not user decisions; change on request)

- `occurredOn` is a date-only `YYYY-MM-DD`, not in the future and not before the equipment's `purchaseDate` when set.
- `BREAKDOWN` is allowed from `OPERATIONAL`, `IN_REPAIR` or `OUT_OF_SERVICE`; `REPAIR` only from `IN_REPAIR` or `OUT_OF_SERVICE`; `MAINTENANCE` and `TRANSFER` from any non-retired status.
- Cost is optional, non-negative, two decimals, ARS; technician is optional free text.
- `REPLACEMENT` replacement equipment, when given, must exist, differ from the replaced one and not be `RETIRED`.
- History order: `occurredOn` desc, then `createdAt` desc.
- Events live in the `equipment` api module (they change the equipment aggregate); the repository gets a transactional "record event" operation.

## Constraints

- Hexagonal module layout; validation schemas in `packages/shared` reused by api and web; new Prisma enums mirrored in zod and in the enum parity test.
- Breaking API change for PATCH status/locationId and `/retire`: the only client is `apps/web`, updated in this feature.
- Generated technical artifacts in English, UI copy in Spanish; test-first where a runnable deterministic test applies.

## Acceptance criteria

- `pnpm lint|typecheck|test|build|format:check` and `pnpm test:integration` pass.
- Recording an event applies its effect atomically; invalid transitions, a same-location transfer, events on `RETIRED` equipment, and future dates return 400 with field issues; unknown equipment returns 404.
- PATCH rejects `status` and `locationId`; `/retire` is gone.
- Web detail shows the history and registers each event type at phone width; covered by component tests.

## Tasks

- [x] T1 Shared: event type enum, discriminated create-event schema, event response schema; tests. (Additive only, so every slice keeps api and web green.) Commit `62792d2`.
- [ ] T1.1 Follow-up (slice 01 review, non-blocking): R3-length-boundaries (SUGGESTION) accept cases at exactly 1000 characters for `description` and exactly 120 for `technician` (`packages/shared/src/equipment-event.test.ts:90-103`). Done in slice 02 alongside T2.
- [ ] T2 API persistence: Prisma `EquipmentEvent` model + migration, enum parity, repository "record event" (atomic event + equipment change) and "list events" in the port, in-memory and Prisma adapters, contract tests (unit + integration).
- [ ] T3 API behavior: record/list event use cases with transition rules, `GET`/`POST /api/equipment/:id/events`, seed events, README.
- [ ] T4 Web history: events API client and history section on the equipment detail page.
- [ ] T5 Web register: "Registrar evento" form with type-specific fields, "Dar de baja" as `RETIREMENT`, remove status/location from the edit form; remove the legacy paths end to end (`status`/`locationId` from `updateEquipmentSchema` and the PATCH use case, `POST /:id/retire` and its use case and client), README.

## Checks

- Per task: focused package tests (RED → GREEN), `pnpm lint`, `pnpm typecheck`, scoped `prettier --check`.
- API persistence tasks: `pnpm test:integration` against the Compose PostgreSQL.
- Closure: full root checks, Docker smoke (`pnpm docker:up`, seed, `curl /api/equipment/:id/events`).

## Routing

- Route: delegated direct per task (writer trigger: 2+ non-trivial files per task).
- T1: delegated direct (writer).

## Delivery

- Forecast: ~2000 authored changed lines (T1 ~250, T2 ~450, T3 ~500, T4 ~350, T5 ~500) — exceeds the ~400 budget.
- Delivery strategy: `ask-on-risk` (default). Chain strategy: `feature-branch-chain` (user decision 2026-11-11).
- Slices (each child PR targets its immediate parent branch; tracker PR stays draft and merges last):
  1. `feat/equipment-events-01-shared` → T1
  2. `feat/equipment-events-02-persistence` → T2
  3. `feat/equipment-events-03-api` → T3
  4. `feat/equipment-events-04-web-history` → T4
  5. `feat/equipment-events-05-web-register` → T5
- Base: `feat/monorepo-scaffold`. Feature branch: `feat/equipment-events`.

## Progress

- 2026-11-11: Exploration done (read-only explorer). User decisions: events drive status/location; status/location only through events; event type table approved; `feature-branch-chain`. Feature document created. Engram mirror `odd/equipment-events/tasks` pending (Engram writes rejected: host session registration).
- 2026-11-11: T1 done (`62792d2`). RED: `pnpm --filter @mantenimiento/shared test` failed 23 of 85 tests (event exports undefined) before the implementation; GREEN: 85 of 85 passed. `pnpm typecheck`, `pnpm lint` and `pnpm exec prettier --check packages/shared odd` pass. Choices: description max 1000 (as equipment notes), technician max 120, cost non-negative with two decimals and at most 99,999,999.99 (T2 should store it as `DECIMAL(10, 2)`); unknown keys and fields of other event types are stripped, like the existing create schemas.
- 2026-11-11: Slice 01 native review (`--base-ref origin/feat/monorepo-scaffold --committed-only`, `.atl/` excluded locally via `.git/info/exclude`): medium, `slice_budget_reached`, consent granted, reliability lens approved, acknowledged. Reviewed boundary `c9e9271`. Advisory R3-length-boundaries recorded as T1.1.

## Next step

Start T2 on `feat/equipment-events-02-persistence`.
