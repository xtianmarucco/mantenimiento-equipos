# syntax=docker/dockerfile:1
# API image. Build from the repository root: docker build -f apps/api/Dockerfile .

ARG NODE_VERSION=26

# --- base: Node + pnpm (corepack is not bundled with Node >= 25, so install it) ---
# Same stage as in apps/web/Dockerfile: keep NODE_VERSION, COREPACK_VERSION and this stage
# identical in both files.
FROM node:${NODE_VERSION}-alpine AS base
ARG COREPACK_VERSION=0.36.0
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm install --global --no-fund --no-audit "corepack@${COREPACK_VERSION}" \
    && corepack enable pnpm
WORKDIR /repo

# --- build: install the API and its workspace deps, then compile ---
FROM base AS build
# Manifests first so the dependency layer is cached until they change. The Prisma schema and
# config are needed because the API's postinstall runs `prisma generate`.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@mantenimiento/api..."

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
# Builds @mantenimiento/shared first, then the API (the generated Prisma client compiles into dist).
RUN pnpm --filter "@mantenimiento/api..." run build

# Self-contained production bundle: prod-only node_modules with the shared package injected.
# - --ignore-scripts: the postinstall needs the `prisma` CLI, a dev dependency.
# - --no-optional: pnpm records the resolved optional peer `prisma` as an optional dependency of
#   @prisma/client, so without this flag the bundle gains the whole CLI (Studio, engines,
#   PGlite): 225 instead of 92 packages, 324 MB instead of 89 MB. None of the dropped packages
#   is a platform-specific binary; the runtime stage checks that the Prisma client still loads.
# - dist is gitignored, so deploy does not pack it; copy the compiled output explicitly.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @mantenimiento/api deploy --prod --ignore-scripts --no-optional \
      --config.inject-workspace-packages=true /prod/api \
    && rm -rf /prod/api/dist \
    && cp -R apps/api/dist /prod/api/dist

# --- migrate: one-shot job that applies Prisma migrations (and can run the dev seed) ---
# Reuses the build stage's full install, which has the `prisma` CLI, the schema engine binary
# downloaded for this platform by `@prisma/engines`, and `tsx` for the seed. Shipping the CLI in
# the runtime image instead would add about 235 MB to its 89 MB bundle (see --no-optional above),
# so the API image stays CLI-free and Compose runs this target before starting the API.
# Build it with `--target migrate`; it must not be the last stage (that is the default target).
FROM build AS migrate
WORKDIR /repo/apps/api
# Puts `prisma` and `tsx` (the seed runner Prisma spawns) on PATH.
ENV PATH=/repo/apps/api/node_modules/.bin:$PATH
USER 1000:1000
CMD ["prisma", "migrate", "deploy"]

# --- runtime: only the deployed bundle, run as the unprivileged `node` user ---
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /prod/api/package.json ./
COPY --from=build --chown=node:node /prod/api/node_modules ./node_modules
COPY --from=build --chown=node:node /prod/api/dist ./dist
# Fail the build if the pruned bundle cannot load the Prisma client and its pg adapter (the
# server does not import them at startup yet). Creating a client opens no connection.
RUN node -e "import('./dist/shared/infrastructure/prisma.js').then((m) => m.createPrismaClient('postgresql://check@127.0.0.1:5432/check'))"
# The image's unprivileged `node` user, by numeric id so runtimes can verify it is non-root.
USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/server.js"]
