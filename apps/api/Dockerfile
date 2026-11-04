# syntax=docker/dockerfile:1
#
# Build context is the REPOSITORY ROOT (pnpm workspace, single lockfile):
#
#   docker build -f apps/api/Dockerfile -t stoic-quote-api .
#
# The Standard Ebooks submodules under apps/api are excluded via the root
# .dockerignore; the generated dataset at apps/api/data/quotes.json is kept.

# =============================================================================
# Build stage
# =============================================================================
FROM node:24-bookworm-slim AS build

# better-sqlite3 has no prebuilt binary for Node 24, so it compiles from
# source: node-gyp needs Python and a C++ toolchain. Bookworm base images ship
# neither. These live only in the throwaway build stage; runtime stays slim.
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

RUN pnpm --filter @stoic-quote/api build

# pnpm 9 "legacy" deploy: writes /app containing the package's own files
# (data/quotes.json, package.json) plus a self-contained production
# node_modules tree, including the native better-sqlite3 binding.
#
# deploy copies files with npm-packlist semantics and therefore honours
# apps/api/.gitignore, which excludes /dist — so the compiled output is
# copied in explicitly. Without this the runtime image has no dist/main.js.
RUN pnpm --filter @stoic-quote/api deploy --prod /app \
    && cp -r /repo/apps/api/dist /app/dist

# =============================================================================
# Runtime stage
# =============================================================================
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY --from=build --chown=node:node /app /app

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
