# Feature: monorepo-scaffold

## Objective

Create the base monorepo for the equipment maintenance app (ice-cream shop: equipment, events, loan agreements), ready to run locally with Docker and verified by CI.

## Problem / Why

The project starts from an empty repository. Every later feature (equipment, events, loans, auth, QR) needs a consistent workspace, a runnable API and web app, a database, containers, and a CI pipeline.

## Scope

- pnpm workspace monorepo with TypeScript everywhere.
- `packages/shared`: zod schemas and types shared by API and web.
- `apps/api`: Express 5 + Prisma (PostgreSQL), hexagonal structure per module, health endpoint.
- `apps/web`: React + Vite + TypeScript + Tailwind CSS v4, PWA-ready, mobile-first shell.
- Docker: multi-stage Dockerfiles for api and web, `docker-compose.yml` with postgres + api + web.
- CI: GitHub Actions running lint, typecheck, tests, build and Docker image builds.

Out of scope: domain models (equipment, events, loans), authentication, deployment target (CD), QR scanning.

## Constraints

- Same backend stack as `stock-control-vue` (Express 5, Prisma, PostgreSQL); React instead of Vue on the frontend.
- Modular monolith, not microservices.
- Generated technical artifacts in English.
- Test-first where a runnable deterministic test applies.

## Acceptance criteria

- `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass from the root.
- `GET /api/health` returns `{ status: "ok" }` and is covered by a test.
- Web app renders a shell that shows the API health status, covered by a test.
- `docker compose up --build` starts postgres, api and web.
- CI workflow runs the same checks on push and pull request.

## Tasks

- [x] T1 Root workspace: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, ESLint + Prettier, `.gitignore`, `.editorconfig`, `.nvmrc`, `README.md`. — `89b3a2a`
- [x] T2 `packages/shared`: health schema with zod + unit test. — `08fd800`
- [x] T3 (`2b4ee7e`) `apps/api`: Express 5 app, hexagonal layout (`src/modules/<module>/{domain,application,infrastructure}`), `GET /api/health` with test, Prisma schema (datasource + generator only), env config.
- [x] T3.1 (`7619384`) Error handler follow-up (slice 02 review, non-blocking): honor `status`/`statusCode` from body-parser client errors (413/415/400) instead of mapping to 500, delegate to `next(err)` when `res.headersSent`, and test the generic 500 path (no internal message leak), JSON content-type on malformed JSON, and an oversized payload.
- [x] T4 (`efe6ca6`) `apps/web`: Vite + React + TS + Tailwind 4 + PWA plugin, app shell showing API health, component test.
- [x] T4.1 (`315d526`, `c3bbc89`) Follow-up (slice 03 review, non-blocking): api `toClientError` must only echo `err.message` when `expose === true` (default to a generic message otherwise); web `getJson` must wrap fetch rejections and JSON parse failures into `ApiError` as documented (let `AbortError` pass through); test the hook's abort-on-unmount behavior (signal passed to fetch, unmount aborts, no state update after abort).
- [x] T5 (`a19a9db`, `7f3f6a3`) Docker: `apps/api/Dockerfile`, `apps/web/Dockerfile` (nginx), `docker-compose.yml`, `.env.example`.
- [x] T6 (`f091893`) CI: `.github/workflows/ci.yml` (install, lint, typecheck, test, build, docker build).
- [ ] T6.1 Follow-up (slice 04 review, non-blocking advisories): R1-001 harden `ci.yml` steps (`ci.yml:21-55`, SUGGESTION); R2 dedupe web Dockerfile base stages (`apps/web/Dockerfile:6-15`, SUGGESTION) and nginx header blocks (`apps/web/nginx.conf:32-49`, WARNING); R3 CI docker job only builds, add a compose smoke test (`ci.yml:38-60`, WARNING) and review `pnpm deploy` optional deps (`apps/api/Dockerfile:33-42`, SUGGESTION); R4 PID 1 signal handling in api container (`apps/api/Dockerfile:57`, SUGGESTION). Compose does not run Prisma migrations yet (needed once models exist).

## Routing

- Route: delegated direct (writer trigger: 2+ non-trivial files per task).

## Delivery

- Forecast: ~800 authored changed lines (lockfile excluded) — exceeds the ~400 budget.
- Delivery strategy: `ask-on-risk` (default).
- Chain strategy: `feature-branch-chain` (user decision 2026-10-30).
- Tracker branch: `feat/monorepo-scaffold` (draft, no-merge tracker PR to `main`).
- Slices (each child PR targets its immediate parent branch):
  1. `feat/monorepo-scaffold-01-workspace` → T1 + T2
  2. `feat/monorepo-scaffold-02-api` → T3
  3. `feat/monorepo-scaffold-03-web` → T4
  4. `feat/monorepo-scaffold-04-delivery` → T5 + T6

## Progress

- 2026-10-30: feature document created; root commit `8ff3201` (`chore: initialize repository`) on `main`; tracker and slice 01 branches created.

- 2026-10-30: T1 + T2 done (delegated writer). RED observed (`Cannot find module './index.js'`), GREEN 3/3 tests. `pnpm install|lint|typecheck|test|build|format:check` all exit 0; parent spot check `pnpm test` 3 passed. Slice 01: 251 authored insertions (lockfile excluded).
- Toolchain notes: ESLint 10 (flat config via `eslint/config`), TypeScript pinned `~6.0` because typescript-eslint 8.72.1 requires `typescript <6.1.0`; root `lint` is a single `eslint .`; base tsconfig uses NodeNext (web will override with `bundler`).

- 2026-10-30: slice 01 native review: assessed medium (`slice_budget_reached`), consent granted, reliability lens approved with no findings, acknowledged. Reviewed boundary: `361841d`.

- 2026-10-30: T3 done — `2b4ee7e` (delegated writer). RED `Cannot find module './env.js'`/`./app.js`; GREEN 9/9 api tests. Clean `pnpm install|lint|typecheck|test|build|format:check` exit 0 after user approved `allowBuilds` (`@prisma/engines`, `esbuild`, `prisma`) in `pnpm-workspace.yaml`. Parent spot check `pnpm test`: shared 3 + api 9 passed. Slice 02: +358/−2 authored. Prisma pinned `^7.10.1` (npm `latest` points to 8.0 RC).
- 2026-10-30: slice 02 native review: medium (`slice_budget_reached`), consent granted, approved, acknowledged. Reviewed boundary: `2b4ee7e`. Two non-blocking findings (WARNING error handler status mapping; SUGGESTION missing error-path tests) → T3.1.

- 2026-10-30: T3.1 done — `7619384`. RED 4 failed/10 passed; GREEN 14/14 api tests; lint/typecheck/test/build/format:check exit 0; parent spot check shared 3 + api 14 passed. Assess (`--base-ref 2b4ee7e`): medium, `review_due: false` (`under_budget`, 143 lines) → pending in the next slice review.

- 2026-10-30: T4 done — `efe6ca6` (delegated writer). RED `Failed to resolve import "./client"` (4 files); GREEN 11/11 web tests. Clean install + lint/typecheck/test/build/format:check exit 0; no new `allowBuilds`. React lint rules live in `apps/web/eslint.config.js` (extends root) because plugins are not hoisted. Parent spot check: shared 3, api 14, web 11 passed. Slice 03: +473/−1 authored.
- 2026-10-30: slice 03 native review (covers T3.1 + T4, `--base-ref 2b4ee7e`): medium (`slice_budget_reached`), consent granted, approved, acknowledged. Reviewed boundary: `efe6ca6`. Three non-blocking findings → T4.1.

- 2026-10-30: T4.1 done — `315d526` (api: echo message only when `expose === true`, else `http.STATUS_CODES` phrase) and `c3bbc89` (web: wrap fetch/JSON failures in `ApiError`, pass `AbortError` through; abort tests as regression guards). RED api 2 failed / web 2 failed; GREEN api 15, web 16. Parent spot check: shared 3, api 15, web 16 passed. Assess (`--base-ref efe6ca6`): medium, `under_budget` (152 lines) → pending in slice 04 review.

- 2026-11-01: T5 + T6 done — `a19a9db` (Docker, +279/−1), `f091893` (CI, +76), `7f3f6a3` (`.env.example`, +6; created by the user because a permission deny rule blocks agents from `.env.example`). Test-first exception: infrastructure config, functional checks instead. `pnpm install --frozen-lockfile|lint|typecheck|test|build|format:check` exit 0; `actionlint` + YAML parse pass; `docker compose build` + `up -d --wait`: db/api/web healthy, `/api/health` via nginx → `{"status":"ok"}`, SPA fallback OK, api runs as uid 1000; `down -v` clean. Parent spot check `pnpm test`: shared 3, api 15, web 16 passed.
- 2026-11-01: slice 04 native review (covers T4.1 + T5 + T6, `--base-ref efe6ca6`): high (`high_risk`, shell in `ci.yml`), consent granted, 4 lenses approved, acknowledged (`review-30d755a7b07de090`). Reviewed boundary: `7f3f6a3`. Seven non-blocking advisories → T6.1.

## Next step

Decide on T6.1 (follow-ups), then push the slice branches and open the chained PRs (user opens PRs on the web).
