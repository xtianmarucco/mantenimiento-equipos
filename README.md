# mantenimiento-equipos

Equipment maintenance app for an ice-cream shop: track equipment, maintenance events and loan
agreements.

## Structure

pnpm workspace monorepo, TypeScript everywhere.

```text
.
├── apps/                # Deployable applications (API and web, added in later slices)
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

Run a script in one package with a filter, for example:

```sh
pnpm --filter @mantenimiento/shared test
```
