# syntax=docker/dockerfile:1
# API image. Build from the repository root: docker build -f apps/api/Dockerfile .

ARG NODE_VERSION=26

# --- base: Node + pnpm (corepack is not bundled with Node >= 25, so install it) ---
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
# - --no-optional: `prisma` is an optional peer of @prisma/client and would pull in the whole
#   CLI (Studio, engines); the generated client only needs @prisma/client's runtime.
# - dist is gitignored, so deploy does not pack it; copy the compiled output explicitly.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @mantenimiento/api deploy --prod --ignore-scripts --no-optional \
      --config.inject-workspace-packages=true /prod/api \
    && rm -rf /prod/api/dist \
    && cp -R apps/api/dist /prod/api/dist

# --- runtime: only the deployed bundle, run as the unprivileged `node` user ---
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /prod/api/package.json ./
COPY --from=build --chown=node:node /prod/api/node_modules ./node_modules
COPY --from=build --chown=node:node /prod/api/dist ./dist
# The image's unprivileged `node` user, by numeric id so runtimes can verify it is non-root.
USER 1000:1000
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/server.js"]
