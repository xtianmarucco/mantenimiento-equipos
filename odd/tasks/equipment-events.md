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
- [x] T1.1 Follow-up (slice 01 review, non-blocking): R3-length-boundaries (SUGGESTION) accept cases at exactly 1000 characters for `description` and exactly 120 for `technician` (`packages/shared/src/equipment-event.test.ts:90-103`). Done in slice 02 alongside T2. Commit `237f462`.
- [x] T2 API persistence: Prisma `EquipmentEvent` model + migration, enum parity, repository "record event" (atomic event + equipment change) and "list events" in the port, in-memory and Prisma adapters, contract tests (unit + integration). Commit `2204bc6`.
- [x] T2.1 Follow-up (slice 02 review, non-blocking): R3-updatedat-contract-wording (SUGGESTION) the port comment says `updatedAt` is bumped only when the effect changes something, but both adapters bump it for any non-empty effect; reword to "non-empty effect" (`apps/api/src/modules/equipment/domain/equipment-repository.ts:31`). Done in slice 03 alongside T3. Commit `62eef24`.
- [x] T3 API behavior: record/list event use cases with transition rules, `GET`/`POST /api/equipment/:id/events`, seed events, README. Commit `003eac0`.
- [x] T3.1 Follow-up (slice 03 review, non-blocking): R3-http-reference-rejections (SUGGESTION) add a router case proving reference-based rejections (unknown transfer location, missing/self/retired replacement) reach the client as 400 at `toLocationId`/`replacementEquipmentId` (`apps/api/src/modules/equipment/infrastructure/equipment-router.test.ts:480`). Done in slice 04 alongside T4. Commit `2050840`.
- [x] T4 Web history: events API client and history section on the equipment detail page. Commit `4b893f6`.
- [ ] T5 Web register: "Registrar evento" form with type-specific fields, "Dar de baja" as `RETIREMENT`, remove status/location from the edit form; remove the legacy paths end to end (`status`/`locationId` from `updateEquipmentSchema` and the PATCH use case, `POST /:id/retire` and its use case and client), README.

## Checks

- Per task: focused package tests (RED → GREEN), `pnpm lint`, `pnpm typecheck`, scoped `prettier --check`.
- API persistence tasks: `pnpm test:integration` against the Compose PostgreSQL.
- Closure: full root checks, Docker smoke (`pnpm docker:up`, seed, `curl /api/equipment/:id/events`).

## Routing

- Route: delegated direct per task (writer trigger: 2+ non-trivial files per task).
- T1: delegated direct (writer).
- T2: delegated direct (writer).
- T3: delegated direct (writer).
- T4: delegated direct (writer).

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

- 2026-11-11: T1.1 done (`237f462`): accept cases at exactly 1000 (`description`) and 120 (`technician`) characters; `pnpm --filter @mantenimiento/shared test` 87 of 87 passed (no RED: boundary cases pin existing behavior).
- 2026-11-11: T2 done (`2204bc6`). Migration `20261112010054_equipment_events` (enum `equipment_event_type`, table `equipment_events`, four Restrict foreign keys, index `(equipment_id, occurred_on DESC, created_at DESC)`, hand-written CHECK `equipment_events_cost_non_negative_check`); a follow-up `migrate dev --create-only` produced an empty migration (schema in sync), discarded. RED: with the new contract suite `equipment-event-repository.contract.ts` wired in, `pnpm --filter @mantenimiento/api test` failed 18 of 137 and `pnpm test:integration` 18 of 51 (`recordEvent`/`listEvents` not functions). GREEN: api 138 of 138 (with the `EquipmentEventType` parity case), integration 51 of 51 against a throwaway PostgreSQL 18.6 container; shared 87 of 87; `pnpm typecheck`, `pnpm lint`, `pnpm exec prettier --check apps/api packages/shared odd` pass. Choices: port `recordEvent(event, effect)` returns `{ event, equipment }` or `undefined` for unknown equipment (like `update`); the Prisma transaction inserts the event first, so its foreign keys prove the references, then applies the effect; foreign key violations are mapped by constraint name (`meta.driverAdapterError.cause.constraint.index`) to `EquipmentEventLocationNotFoundError` (`fromLocationId`/`toLocationId`) and `ReplacementEquipmentNotFoundError`; an unknown effect location stays `EquipmentLocationNotFoundError`; `updatedAt` moves only for a non-empty effect; history order `occurredOn`, `createdAt`, id, all descending; cost is a number in the domain, `DECIMAL(10, 2)` in the database. Minimal compile fix outside the planned files: `apps/api/prisma/seed.ts` omits the new relation fields from its `Required<...>` sample types.
- 2026-11-11: Slice 02 native review (`--base-ref c9e9271 --committed-only`): medium, `slice_budget_reached`, consent granted, reliability lens approved, acknowledged. Reviewed boundary `04beb0c`. Advisory R3-updatedat-contract-wording recorded as T2.1. Parent spot check: api 138/138.

- 2026-11-11: T2.1 done (`62eef24`): port comment says `updatedAt` is bumped for any non-empty effect (no RED: wording only).
- 2026-11-11: T3 done (`003eac0`). RED: new use case suite failed to load (`record-equipment-event.js` missing), 11 of 13 new router cases failed (404 routes; the two 404 cases passed by accident), shared failed 2 of 89 (`recordEquipmentEventResponseSchema` undefined). GREEN: shared 89 of 89, api 173 of 173, `pnpm test:integration` 51 of 51 against a throwaway PostgreSQL 18.6 container; seed run twice against it, both runs 6 equipment and 8 events (plus one leftover location from the integration run) with each item's newest event matching its status; `pnpm typecheck`, `pnpm lint`, `pnpm exec prettier --check apps/api packages/shared odd README.md` pass. Choices: `RecordEquipmentEventUseCase` checks in order retired (issue at `type`), date range (`occurredOn`, against an injected `today: () => YYYY-MM-DD`, default the process time zone's date via `localToday`, threaded through `createApp({ today })` and `createEquipmentModule`), then the type rule; the first broken rule is reported; rule failures are `InvalidEquipmentEventError` (a `DomainValidationError`), unknown transfer location and replacement equipment reuse `EquipmentEventLocationNotFoundError` and `ReplacementEquipmentNotFoundError`; added `recordEquipmentEventResponseSchema` (`{ event, equipment }`) to shared; seed deletes and re-inserts the sample equipment's events with fixed ids inside the existing transaction. Accepted race: the rules read the equipment before the write without a lock, so two concurrent events can both pass against the same status (single owner, no auth); documented in the use case and the README. The commit is ~1130 changed lines (about 620 of them tests), over the ~400 planning heuristic, because the rules need every success and failure case covered.
- 2026-11-11: Slice 03 native review (`--base-ref 04beb0c --committed-only`): medium, `slice_budget_reached`, consent granted, reliability lens approved, acknowledged. Reviewed boundary `f72c41c`. Advisory R3-http-reference-rejections recorded as T3.1. Parent spot check: api 173/173.

- 2026-11-11: T3.1 done (`2050840`): router cases for a transfer to an unknown location (400 at `toLocationId`, "Location does not exist") and a missing, self or retired replacement (400 at `replacementEquipmentId`, equipment status unchanged); api 177 of 177 (no RED: the cases pin existing behavior).
- 2026-11-11: T4 done (`4b893f6`). RED: `pnpm --filter @mantenimiento/web test` failed 3 suites (the `EquipmentEventHistory` suite failed to load; 6 failed tests: 3 `listEquipmentEvents` client cases, 3 detail page history cases). GREEN: web 178 of 178; api 177 of 177; `pnpm typecheck` (after `pnpm --filter @mantenimiento/shared build`), `pnpm lint`, `pnpm exec prettier --check apps/web apps/api odd` pass. Choices: `listEquipmentEvents` lives in `shared/api/equipment.ts` (reuses the private `equipmentPath`); `EVENT_TYPE_LABELS` in `labels.ts`; presentational `EquipmentEventHistory` (a `region` named "Historial", `<ol>` in API order, `<time dateTime>`, details `<dl>` only for the fields that are set: Técnico, Costo as `Intl.NumberFormat('es-AR', ARS)`, Estado resultante, Desde/Hacia location names with "Ubicación desconocida" for unknown ids and the location load error/loading copy like the detail's location field, Reemplazo link "Ver equipo de reemplazo" to `/equipos/:id` without a fetch); the page loads the history with its own `useResource`, and a fresh load function (`reloadEvents`) serves both "Reintentar" and the refresh after a successful retire, ready for T5's event-based actions.

## Next step

Start T5 on `feat/equipment-events-05-web-register`.
