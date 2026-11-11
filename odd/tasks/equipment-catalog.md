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

- [x] T1 (`72cd417`) `packages/shared`: zod schemas + types for Location and Equipment (enums, create, update, response, list query) with unit tests.
- [x] T2 (`64e3ab0`, `d85b5ed`) `apps/api` persistence: Prisma models + first migration + seed; a one-shot compose `migrate` service runs `prisma migrate deploy` before the api starts; README.
- [x] T2.1 (`dead59e`, `b7f20d9`, `d5d70ef`, `90f3208`, `6b5fdde`) Follow-up (slice 01 review, non-blocking): document and test the phone length boundary (`packages/shared/src/location.ts:16-20`, WARNING x2); make the seed restore seeded rows to their canonical values on re-run (`apps/api/prisma/seed.ts:125-136`, WARNING); add an enum parity test between shared and Prisma enums (`schema.prisma:4`, SUGGESTION); clarify input type naming (`packages/shared/src/equipment.ts:82-92`, SUGGESTION).
- [x] T3 (`6c5f0ce`) `apps/api` locations module: domain, use cases, Prisma repository, router (`/api/locations`), tests with in-memory repository and HTTP tests.
- [x] T3.1 (`86e00b4`, `c2d6a3e`, `2b720e4`, `4adce0f`, `1694be7`) Follow-up (slice 02 review, non-blocking): integration tests for `PrismaLocationRepository` against a real Postgres (`prisma-location-repository.ts:54-69`, WARNING); in-memory repository sort must match Prisma (name, then id) (`in-memory-location-repository.ts:14-19`, WARNING + SUGGESTION); clarify `packages/shared/src/location.ts:41` per review (WARNING).
- [x] T3.2 (`6468afe`) Spanish alphabetical sort (user decision 2026-11-01): ICU `es` collation (case- and accent-insensitive ordering) on `locations.name` and `equipment.name` via migration; in-memory repository uses the same rule (`Intl.Collator('es')`), contract test updated.
- [x] T3.3 (`2a2ddf8`, `befc9c7`) Follow-up (slice 02 second review, non-blocking): document the ICU collation version runbook (`ALTER COLLATION es_natural REFRESH VERSION` + `REINDEX` after an image with a different icu-libs) in README/schema comment and consider pinning the postgres image minor version (R3-001 WARNING, R4-001); integration test helpers (`test-database-url.ts:14-25`, `global-setup.ts:9-14`), in-memory comparator and integration test suggestions (R1-001, R2-002, R3-002, R3-003).
- [x] T4 (`070566d`, `3aebf6b`, `39ea594`) `apps/api` equipment module: domain, use cases (list with filters, get, create, update, retire), Prisma repository, router (`/api/equipment`), 409 on duplicate code, tests.
- [x] T4.1 (`0cc5f03`, `fa09784`) Follow-up (confirmed by slice 03 review R3-001 WARNING): database CHECK constraint `warranty_until >= purchase_date` so concurrent PATCHes cannot store an inconsistent pair (application-only today); map its violation to 400 at `warrantyUntil`; also R2-001 explicit null check for `warrantyUntil` in the Prisma create mapping (`prisma-equipment-repository.ts:117`).
- [x] T5 (`879847b`, `c4d247f`) `apps/web` routing + equipment list page with status/location filters (mobile-first), api client functions, tests.
- [x] T5.1 (`6dbf0d6`, `3b36a6a`) Follow-up (slice 04 review): R3-002 (SUGGESTION) a URL `locationId` absent from the loaded locations must stay visible and clearable in the filter (or be dropped) — `EquipmentFilterBar.tsx:47-61`; R3-001 (WARNING) README runbook query to detect rows violating `equipment_warranty_after_purchase_check` before deploying the migration to a database with existing data (no production data exists yet; migration already applied locally, so it stays unchanged).
- [x] T6 (`04deb64`, `1e037b8`) `apps/web` equipment detail + create/edit form (shared zod validation, location select), tests.
- [x] T6.1 (940edfb) Follow-up (slice 05 review): R3-001 (WARNING) `apps/web/src/features/equipment/EquipmentForm.tsx:146-154`; R3-002 (SUGGESTION) `apps/web/src/features/equipment/EquipmentDetailView.tsx:140-149` — details in the review artifacts.
- [x] T7 (`633465c`) `apps/web` locations list + create/edit form, tests.
- [ ] T7.1 (not scheduled) Follow-up (slice 05 second review, non-blocking): R3-001 (WARNING) prove the edit page's non-404 load error and loading branches (`LocationLoadStatus.tsx:33-37`); R3-002 (WARNING) prove `submitErrorFromApi` 404 and non-`ApiError` mappings (`locationFormModel.test.ts:106-155`); R3-003 (SUGGESTION) add a retry affordance to the locations list error (`LocationList.tsx:30-39`).

## Routing

- Route: delegated direct per task (writer trigger: 2+ non-trivial files per task). T7: inline direct — the `general` subagent was unavailable ("Free usage limit reached"); the parent ran the focused web checks and the full repo checks.

## Delivery

- Forecast: ~1800 authored changed lines (migration SQL and generated Prisma client excluded) — exceeds the ~400 budget.
- Delivery strategy: `ask-on-risk` (default). Chain strategy: `feature-branch-chain` (user decision 2026-11-01).
- Slices (each child PR targets its immediate parent branch):
  1. `feat/equipment-catalog-01-persistence` → T1 + T2 (+ T2.1) — PR #5
  2. `feat/equipment-catalog-02-locations-api` → T3 (+ T3.1–T3.3) — PR #6
  3. `feat/equipment-catalog-03-equipment-api` → T4 (+ T4.1) — PR #7
  4. `feat/equipment-catalog-04-web-list` → T5 — PR #8
  5. `feat/equipment-catalog-05-web-forms` → T5.1 + T6 (+ T6.1) + T7 — PR #9
- Tracker PR: #4 (draft, base `feat/monorepo-scaffold`).
- Base: `feat/monorepo-scaffold-04-delivery` (scaffold not merged to `main` yet). Tracker branch: `feat/equipment-catalog`.

## Progress

- 2026-11-01: design agreed with the user; feature document created on `feat/equipment-catalog`.

- 2026-11-01: T1 + T2 done (delegated writer). T1 RED 51 failed / 3 passed, GREEN 54/54 (code regex `^[A-Z]{2,4}-\d{4}$`, trimmed + uppercased). T2: tables `locations`/`equipment`, unique `code`, indexes on `location_id`/`status`, FK `ON DELETE RESTRICT`, idempotent seed (4 locations, 6 equipment). Deviation accepted: migrations run in a one-shot `migrate` compose service (build-stage image) instead of the api runtime image, which would grow from 89 MB to ~324 MB with the Prisma CLI. Parent fix `d85b5ed`: api typecheck now includes `prisma/` (seed). Checks: pnpm install/lint/typecheck/test/build/format:check exit 0; compose up on fresh volume applies migration; seed counts verified; actionlint clean. Parent spot check: typecheck, lint, format, tests (shared 54, api 15, web 16) passed. Authored: +560 (T1, 370 tests), ~360 (T2, migration SQL excluded).
- 2026-11-01: slice 01 native review (`--base-ref 49c58c9`): high (shell in `ci.yml`), consent granted, 4 lenses approved, acknowledged. Reviewed boundary: `d85b5ed`. Non-blocking advisories → T2.1. Pending for T4: an update with only one date must validate the warranty rule against the stored record.

- 2026-11-01: T2.1 done (delegated writer). Phone: trim then 6–20 chars (incl. `+`) matching `VARCHAR(20)`; RED 1 failed/58 passed → GREEN 59/59. Enum parity test (passed first run, regression guard, no RED). Seed restores canonical values on re-run (explicit `null`s, `Required<Omit<...UncheckedCreateInput>>` types) — verified live: edited rows restored, counts 4/6. `*Input` = `z.input`, bare names = parsed values. `schema.prisma` comment-only (`migrate diff`: empty migration). Checks: lint/typecheck/test/build/format:check pass; parent spot check tests shared 59, api 18, web 16. Assess (`--base-ref d85b5ed`): medium, `under_budget` → pending in the slice 02 review.

- 2026-11-01: T3 done — `6c5f0ce` (delegated writer, +901/−10, ~440 tests). Locations module (domain port, use cases, Prisma + in-memory repositories, router `/api/locations` GET/GET:id/POST/PATCH, no DELETE). `createApp(dependencies)` DI; `server.ts` builds Prisma repo and disconnects on shutdown. Errors: `RequestValidationError` → 400 with issues, `NotFoundError` → 404, unexpected `ZodError` → 500; error contract `errorResponseSchema` moved to `packages/shared/src/http-error.ts`. RED shared 3 failed / api 3 suites failed → GREEN shared 62, api 40. Live: seeded list sorted, POST 201, PATCH 200, unknown uuid 404 (GET and PATCH, `P2025` mapping), bad uuid / empty PATCH 400. Parent spot check: tests shared 62, api 40, web 16.
- 2026-11-01: slice 02 native review (covers T2.1 + T3, `--base-ref d85b5ed`): high (update path), consent granted, 4 lenses approved, acknowledged. Reviewed boundary: `6c5f0ce`. Non-blocking advisories → T3.1 (R2-003 stale task log fixed by this entry).

- 2026-11-01: T3.1 done (delegated writer + parent `1694be7`). Integration setup for reuse: `pnpm test:integration` → `apps/api/vitest.integration.config.ts`, files `src/**/*.integration.test.ts`, requires `DATABASE_URL` with a db name ending in `_test`, global setup runs `prisma migrate deploy`, helpers `src/test/integration/test-database.ts` (`createTestPrismaClient`, `truncateAllTables`), contract suite pattern `location-repository.contract.ts` run against in-memory (unit) and Prisma (integration). CI `integration` job with a `postgres:18-alpine` service. Sort: postgres:18-alpine (musl) sorts `en_US.utf8` by code point, so the in-memory repo compares UTF-8 bytes; RED 1/8 (astral vs fullwidth char), GREEN 8/8. Use cases renamed `*UseCase` (T4 must follow: `CreateEquipmentUseCase`). Parent: build excludes `*.contract.ts` and `src/test/**` (verified dist has no test files). Checks: lint/typecheck/test (no DB) /build/format:check pass; integration 9/9 twice; missing `DATABASE_URL` and non-`_test` db refused; actionlint clean. Parent spot check: tests shared 62, api 52, web 16.
- Open product decision: code-point order puts accented names ("Álamo", "Ñandú") after "zeta"; a Spanish ICU collation would sort naturally and consistently across libc.

- 2026-11-01: T3.2 done — `6468afe` (delegated writer, +76/−29). Deterministic ICU collation `es_natural` (`provider = icu, locale = 'es'`, default strength) on `locations.name` and `equipment.name`; in-memory: `Intl.Collator('es', { sensitivity: 'variant' })`, then UTF-8 bytes, then id. Node ICU 78.3 and image icu-libs 78.1 agreed on ~35 probes. Prisma does not model collations: schema comment; drift check "No difference detected", `migrate dev` "Already in sync". RED unit 1 / integration 1 failed → GREEN unit 28, integration 10/10 twice. Live: `Álamo | almacén | Heladería Centro | … | nube | Ñandú | Zeta`. T4: order by name, id; reuse the in-memory comparator; new name columns need `COLLATE "es_natural"`. Parent spot check: tests shared 62, api 53, web 16.

- 2026-11-01: slice 02 second native review (T3.1 + T3.2, `--base-ref 6c5f0ce`): high, consent granted, 4 lenses approved, acknowledged. Reviewed boundary: `3826912`. Non-blocking advisories → T3.3 (R2-001 stale task log fixed by this entry).

- 2026-11-01: T3.3 done (delegated writer). Postgres pinned to `postgres:18.6-alpine3.24` (same image ID as current `18-alpine`; Alpine release fixes the ICU major; no digest pin, consistent with repo policy) in compose and CI; README "Collation version" runbook (detection query, `REINDEX` + `ALTER COLLATION es_natural REFRESH VERSION`), schema comment points to it. Test DB URL guard rejects `dbname`/`database`/`db` query params (RED 3 failed → GREEN 7/7); P2000 error kind asserted; helper docblocks and comparator ICU note. Checks: lint/typecheck/test/build/format:check pass, actionlint clean, integration 10/10, runbook query `153.136.48 | 153.136.48`, schema diff comment-only. Parent spot check: pins grep, tests shared 62, api 56, web 16.

- 2026-11-01: T3.3 native review (`--base-ref 3826912`): high (shell in `ci.yml`), consent granted, 4 lenses approved, acknowledged. Reviewed boundary: `e0de0e5`. Three minor suggestions (comparator comment `in-memory-location-repository.ts:16-17`, `README.md:123`, `test-database-url.test.ts:22-31`) not scheduled. Slice 02 complete.

- 2026-11-01: T4 done (delegated writer). `070566d` shared Spanish comparator `bySpanishNameThenId`; `3aebf6b` `ConflictError` → 409, `DomainValidationError` (with issues) → 400; `39ea594` equipment module (+1861/−18, ~1100 tests — exceeds the ~400 heuristic because of tests, accepted). Decisions: default list excludes `RETIRED` (`?status=RETIRED` lists only retired); PATCH may set any status (also un-retire); `POST /:id/retire` idempotent (no `updatedAt` bump); duplicate code `P2002` → 409; location checked through the port, racing `P2003` → 400 at `locationId`; warranty rule checked against the stored record (400 at `warrantyUntil`); date-only fields as `YYYY-MM-DD` at UTC midnight. RED 4 suites + 2 handler tests → GREEN api 119; integration 30/30 twice. Live checks all as expected. Parent spot check: tests shared 62, api 119, web 16.

- 2026-11-01: slice 03 native review (T4, `--base-ref 0c17b47`): high (update path), consent granted, 4 lenses approved, acknowledged. Reviewed boundary: `9b4d3cb`. Advisories → T4.1 (R2-002 stale task log fixed by this entry).

- 2026-11-01: T4.1 done (delegated writer). Migration `20261101210000_equipment_warranty_check` adds `equipment_warranty_after_purchase_check`; schema comment (Prisma ignores CHECK: no drift). On this stack the violation is `PrismaClientKnownRequestError` `P2039` with SQLSTATE `23514` in `meta.driverAdapterError.cause`; mapped to `WarrantyBeforePurchaseError` only when the message names this constraint. RED 2/33 (bypass tests) → GREEN 33/33 twice; seed satisfies the rule. R2-001 explicit null check. Parent spot check: tests shared 62, api 119, web 16; format:check clean. Assess (`--base-ref 9e6cbe9`): medium, `under_budget` → pending in the slice 04 review. Slice 03 complete.

- 2026-11-01: T5 done (delegated writer). `879847b` routing (`react-router@^8.5.1`, single route table; `/` → `/equipos`; placeholders for `/equipos/nuevo`, `/equipos/:id`, `/ubicaciones`; not-found page), app shell, api client (`listEquipment(filters, { signal })`, `listLocations`, `ApiError` with `status`/`apiMessage` from the shared error contract), `useResource` hook with abort. `c4d247f` list page: container `EquipmentListPage` + pure `EquipmentListView`/`EquipmentFilterBar`/`EquipmentList`/`StatusBadge`; Spanish labels in `labels.ts`; URL query string is the source of truth (validated with shared schemas, `replace` history); extra Tipo filter. Health card moved to the shell footer. RED 3+4 suites → GREEN web 55. Live: SPA routes 200, API filters match; phone-width screenshot reviewed by parent (cards, badges with text, filters). Parent spot check: tests shared 62, api 119, web 55. Note: API error details are in English and are shown as "Detalle: …" in the Spanish UI — revisit in T6 when forms surface validation errors.

- 2026-11-01: slice 04 native review (T4.1 + T5, `--base-ref 9e6cbe9`): medium (`slice_budget_reached`), consent granted, reliability lens approved, acknowledged. Reviewed boundary: `d8a3c23`. Advisories → T5.1 (done together with T6 in slice 05).

- 2026-11-01: T5.1 + T6 done (delegated writer). T5.1: unknown URL `locationId` stays applied and visible as "Ubicación desconocida" (clearable); README pre-migration query for warranty violations (0 rows live). T6: detail page (warranty status, retire with inline confirmation, not-found for invalid/missing ids), shared create/edit form controller, `sendJson`, `ApiError.issues`; Spanish messages via `z.config(z.locales.es())` plus a web-side mapping by field and issue code (API messages unchanged, shown only as "Detalle:" fallback); edit validates the full form then PATCHes only changed fields (blank optional → `null`); list filters preserved through router state. `1e037b8` +1427/−16, mostly tests (heuristic exceeded, accepted). RED → GREEN per suite, web 115. Playwright at 390px: duplicate code and warranty errors focus the field, create/edit/retire/not-found flows OK; parent reviewed the warranty-error screenshot. Parent spot check: tests shared 62, api 119, web 115. Note: native date inputs follow the browser locale (screenshots in en-US show mm/dd/yyyy).

- 2026-11-01: slice 05 native review (T5.1 + T6, `--base-ref 01be20f`): medium (`slice_budget_reached`), consent granted, reliability lens approved, acknowledged. Reviewed boundary: `244395b`. Advisories → T6.1.

- 2026-11-01: T6.1 done (`940edfb`): R3-001 — `EquipmentForm` keeps the location select disabled with the load-error copy and offers a "Reintentar" affordance when `GET /api/locations` fails; R3-002 — `EquipmentDetailView.locationLabel` shows a load error instead of collapsing it into "Ubicación desconocida". RED → GREEN per suite, web 118; parent spot check: lint/typecheck/test/build/format clean.

- 2026-11-02: T7 done (`633465c`, inline — delegation unavailable). API client `getLocation`/`createLocation`/`updateLocation`; `/ubicaciones` list with loading/empty/error states and edit links; create/edit form with shared-schema validation (`locationFormModel`), Spanish messages, blank optional → omitted on create and `null` on update; edit PATCHes only changed fields and navigates back without a request when nothing changed; invalid/missing id → "Ubicación no encontrada"; no delete (the API has none). Tests authored first (RED: suites failed to import before the components existed) → GREEN web 152. Checks: lint/typecheck/test/build/format:check clean; shared 62, api 119, web 152. Native review (T6.1 + T7, `--base-ref 3f8f72…`): medium, reliability lens approved, acknowledged; reviewed boundary `633465c`. Advisories R3-001/R3-002/R3-003 recorded as unscheduled T7.1.

- 2026-11-02: branches pushed and chained PRs opened: tracker #4 (draft) → #5 (persistence) → #6 (locations API) → #7 (equipment API) → #8 (web list) → #9 (web forms). All CI checks green on every PR (lint/typecheck/test/build, Docker smoke, API integration).

## Next step

Review and integrate the child PRs in order (#5 → #9); merge tracker #4 only after the chain completes.
