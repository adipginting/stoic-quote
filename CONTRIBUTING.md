# Contributing

## Prerequisites

- Node.js ≥ 22.12 and pnpm 9 (`corepack enable`).
- Optional: Docker, and `kubectl` + a k3s cluster for deployment work.

## Setup

```bash
git submodule update --init    # Standard Ebooks sources (needed only to re-extract)
pnpm install
cp .env.example .env           # optional; features stay off until keys are set
```

## Running

```bash
pnpm dev
# api → http://localhost:3000  (Swagger at /api-doc)
# web → http://localhost:3001
```

See [README.md](./README.md) for the environment variables and
[docs/observability.md](./docs/observability.md) for enabling telemetry.

## Checks

Run these before pushing — they mirror CI:

```bash
pnpm check-types   # tsc across both apps
pnpm lint          # eslint (api; the web app has no lint script yet)
pnpm test          # jest (api) + vitest (web), no network
pnpm build         # nest build + vite/nitro build
```

Tests must be hermetic: no network, no API keys, and no reliance on the real
SQLite file (point `SQLITE_PATH` at a temp file if a test needs one). Web tests
use Vitest (`apps/web/vitest.config.ts`); DOM-dependent tests opt in with a
`// @vitest-environment jsdom` docblock.

## Changing the dataset

`apps/api/data/quotes.json` is generated, not hand-edited:

```bash
pnpm extract       # regenerate from the submodules
git diff apps/api/data
```

Commit the result. CI re-runs the extractor and fails if the committed file
differs, so an uncommitted regeneration will break the build.

## Conventions

- TypeScript throughout; follow the patterns already in the nearest file.
- The v1 endpoints are frozen for existing consumers — add new behaviour under
  `/v2/*` instead of changing v1.
- Web code that touches the API or secrets must stay server-only
  (`import '@tanstack/react-start/server-only'`, or a `*.server.ts` file).
- Never log secrets or payloads; keep the pino redaction list current when
  adding headers that carry identity.

## CI/CD

Both `.github/workflows/main.yaml` and `.gitlab-ci.yml` run the same pipeline:

1. **verify** — `pnpm build`, `pnpm test`, and the dataset freshness check.
2. **docker** — build and push the `api` and `web` images, tagged with the
   commit SHA (default branch only).
3. **deploy** — `kubectl apply -f k3s/` and pin the deployments to that SHA
   (default branch only).

Pull requests must pass **verify**; Docker/deploy only run on the default
branch.

## Commits and pull requests

- Write a short, imperative subject (e.g. "Add OpenTelemetry tracing and pino
  logging").
- Keep pull requests focused; describe the behaviour change and any config or
  migration it needs.
- Note anything that touches the dataset, the v1 endpoints, or the deployment
  manifests.
