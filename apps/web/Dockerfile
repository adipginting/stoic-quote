# syntax=docker/dockerfile:1
#
# Build context is the REPOSITORY ROOT (pnpm workspace, single lockfile):
#
#   docker build -f apps/web/Dockerfile -t stoic-quote-web .
#
# Nitro emits a self-contained server bundle at apps/web/.output, so the
# runtime stage needs no node_modules.

# =============================================================================
# Build stage
# =============================================================================
FROM node:24-bookworm-slim AS build

# The workspace install also pulls in the API's better-sqlite3, which has no
# prebuilt binary for Node 24 and compiles from source: node-gyp needs Python
# and a C++ toolchain. These stay in the throwaway build stage.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Pin the package manager instead of relying on corepack's registry lookup.
RUN npm install -g pnpm@9.0.0

WORKDIR /repo

# Manifests first so the pnpm store layer is cached independently of source.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @stoic-quote/web build

# =============================================================================
# Runtime stage
# =============================================================================
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY --from=build --chown=node:node /repo/apps/web/.output ./.output

USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
