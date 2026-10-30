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
- [ ] T3 `apps/api`: Express 5 app, hexagonal layout (`src/modules/<module>/{domain,application,infrastructure}`), `GET /api/health` with test, Prisma schema (datasource + generator only), env config.
- [ ] T4 `apps/web`: Vite + React + TS + Tailwind 4 + PWA plugin, app shell showing API health, component test.
- [ ] T5 Docker: `apps/api/Dockerfile`, `apps/web/Dockerfile` (nginx), `docker-compose.yml`, `.env.example`.
- [ ] T6 CI: `.github/workflows/ci.yml` (install, lint, typecheck, test, build, docker build).

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

## Next step

Native review of slice 01, then T3 on `feat/monorepo-scaffold-02-api`.
