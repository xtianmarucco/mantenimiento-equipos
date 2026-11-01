# syntax=docker/dockerfile:1
# Web image. Build from the repository root: docker build -f apps/web/Dockerfile .

ARG NODE_VERSION=26
ARG NGINX_VERSION=1.30

# --- base: Node + pnpm (corepack is not bundled with Node >= 25, so install it) ---
FROM node:${NODE_VERSION}-alpine AS base
ARG COREPACK_VERSION=0.36.0
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN npm install --global --no-fund --no-audit "corepack@${COREPACK_VERSION}" \
    && corepack enable pnpm
WORKDIR /repo

# --- build: install the web app and its workspace deps, then build static files ---
FROM base AS build
# Manifests first so the dependency layer is cached until they change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@mantenimiento/web..."

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
# Type-checks and builds into apps/web/dist (the shared package is consumed from source).
RUN pnpm --filter @mantenimiento/web run build

# --- runtime: static files served by unprivileged nginx (uid 101, port 8080) ---
FROM nginxinc/nginx-unprivileged:${NGINX_VERSION}-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/"]
