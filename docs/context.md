# Project context

Working context for the Stoic Quote monorepo: what it is, the decisions behind
the observability layer, what has been built, and what is still open. Written as
a handoff so the reasoning survives beyond the session that produced it.

Related docs: [architecture.md](./architecture.md) · [api.md](./api.md) ·
[observability.md](./observability.md) · [../CONTRIBUTING.md](../CONTRIBUTING.md).

## 1. What this is

A monorepo with two deployables and one generated dataset:

- `apps/api` — NestJS API (CommonJS) over `apps/api/data/quotes.json`, with
  SQLite for favourites and the DeepSeek/Unsplash caches.
- `apps/web` — TanStack Start site (React 19, Vite 8, Nitro, ESM). The browser
  never calls the API directly; everything goes through server functions.
- Optional integrations: **DeepSeek** (quote explanations) and **Unsplash**
  (imagery). Both are enabled purely by env var; absent keys hide the feature.

## 2. Decision log — observability (the grilling)

These were settled explicitly (Q1–Q6, then Q7–Q12) before any code was written.

| # | Decision | Conclusion |
| --- | --- | --- |
| Q1 | Primary outcome | Production feedback on errors/slow external calls **plus** structured logs. Alerting/SLOs explicitly out of scope. |
| Q2 | Scope | **API + web server**. Browser RUM deferred. |
| Q3 | Destination | **Managed OTLP backend**, instrumented vendor-neutrally. No in-cluster collector. |
| Q4 | Signals | **Logs + traces, correlated.** Metrics deferred. |
| Q5 | Correlation | **Yes** — one user action is one trace: web → api → DeepSeek/Unsplash. |
| Q6 | Constraints | Free tier, ~one session of effort; redact visitor id and DeepSeek bodies; opt-in via env. |
| Q7 | Backend + topology | **Grafana Cloud**, apps export OTLP **directly**. No collector. |
| Q8 | API logging | **`nestjs-pino`** (request logging, replaces Nest's logger). |
| Q9 | Instrumentation | **Targeted** `instrumentation-http` + `instrumentation-undici` (not `auto-instrumentations-node`). |
| Q10 | Sampling | **100%** (`parentbased_always_on`); revisit on volume. |
| Q11 | Env contract | Standard `OTEL_*` + `LOG_LEVEL`; SDK is a **no-op** when the endpoint is unset. |
| Q12 | Redaction | Remove `x-visitor-id`, `authorization`, `cookie`, `set-cookie`; never log bodies/prompts; keep client IP. |

### Deviations from the stated plan

- **Loading mechanism.** Q9 proposed a `--require` preload for the API; the
  implementation instead imports `./otel` as the first line of `main.ts`
  (equivalent ordering, works for both `nest start` and the compiled `dist`).
  The web uses TanStack Start's **custom server entry** (`src/server.ts`), which
  is the framework's supported init point, rather than `--import`.
- **Pretty logs.** `pino-pretty` only applies under `vite dev`; the *bundled*
  web server logs JSON (the transport cannot resolve inside the standalone
  Nitro output). Acceptable for production; noted in the runbook.

## 3. What was built

### API (`apps/api`)

| File | Role |
| --- | --- |
| `src/otel.ts` | NodeSDK bootstrap (OTLP traces + logs, http/undici/pino instrumentation), opt-in |
| `src/logger.config.ts` | `nestjs-pino` params + redaction paths |
| `src/main.ts` | Imports `./otel` first; installs pino logger + `LoggerErrorInterceptor` |
| `src/app.module.ts` | Registers `LoggerModule.forRoot(loggerParams)` |

Verified: boots, logs each request, redacts `x-visitor-id`, and — with an OTLP
endpoint set — production JSON logs carry `trace_id`/`span_id`.

### Web (`apps/web`)

| File | Role |
| --- | --- |
| `src/server.ts` | Custom Start server entry; imports the OTel bootstrap first |
| `src/lib/otel.server.ts` | NodeSDK bootstrap (`stoic-quote-web`) |
| `src/lib/logger.server.ts` | Server-only pino logger |
| `src/lib/api.ts` | Logs failures (path/status only) through the logger |

Verified: Nitro bundles OTel+pino into `.output`; the API received a W3C
`traceparent` from the web and continued the same trace.

### Tests

- API: Jest (`src/app.controller.spec.ts`) — pre-existing.
- Web: **Vitest** (`vitest.config.ts`) covering `src/lib/api.test.ts` (client
  behaviour) and `src/lib/visitor.test.ts` (visitor id). 8 tests.
- `pnpm test` runs jest (api) + vitest (web).

### CI/CD

- GitHub Actions `.github/workflows/main.yaml`: verify → docker (matrix
  api/web) → deploy. Added a **lint** step to verify.
- GitLab `.gitlab-ci.yml`: the same pipeline; same lint step added.
- Requires `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, and a base64 `KUBECONFIG`.

### Config and deploy

- `.env.example` documents all variables including `LOG_LEVEL` and `OTEL_*`.
- k3s prod (`k3s/`) and dev (`k3s/dev/`) deployments, plus `docker-compose.yml`,
  read `OTEL_EXPORTER_OTLP_ENDPOINT`/`_HEADERS` from `stoic-quote-secrets`
  (`optional: true`), so telemetry stays off until configured.

### Docs

`README.md`, `docs/architecture.md`, `docs/api.md`, `docs/observability.md`,
`CONTRIBUTING.md`, and this file. All relative links verified.

## 4. Invariants and conventions

- **v1 endpoints are frozen**; new behaviour goes under `/v2/*`.
- **Server-only web code** touches the API or secrets
  (`@tanstack/react-start/server-only` / `*.server.ts`).
- **Telemetry is opt-in and vendor-neutral** (OTLP); unset env means zero cost.
- **Never log secrets or payloads**; keep the pino redaction list current.
- **SQLite is a single writer** — the API runs one `Recreate` pod.
- **Unsplash images are hotlinked** (never rehosted) with attribution.
- **The dataset is generated** by `apps/api/scripts/extract.mjs` and committed;
  CI fails if it is stale.

## 5. Verification status

Run and green at the time of writing:

| Command | Result |
| --- | --- |
| `pnpm check-types` | 2 tasks pass |
| `pnpm lint` | api only (web has no ESLint) |
| `pnpm test` | jest (api) + vitest (web) pass |
| `pnpm build` | nest + vite/nitro build pass |
| API smoke | boot, request logs, redaction, trace context |
| Web↔API trace | `traceparent` received and trace continued |

No commits were made for this work — the repository carries the changes
uncommitted alongside pre-existing work-in-progress.

## 6. Open items

- **Web ESLint** — not added. The web app is on TypeScript 6.0.3 (beta) and
  Vite 8, while the workspace's ESLint is 8.57 / `@typescript-eslint` 5.62.
  The clean path is a web-only **ESLint 9 flat config + `typescript-eslint` 8**,
  as its own change.
- **`UNSPLASH_ACCESS_KEY`** — awaiting the key to be placed in a local `.env` or
  the `stoic-quote-secrets` secret.
- **CI lint uses `--fix`** (api script); consider a non-mutating variant for CI.
- **Browser RUM** and **metrics** were deliberately deferred (Q2/Q4).

## 7. Penpot design context

A separate Penpot file (page `Web`) holds the UI design, built from `apps/web`:

- Screens: Home (desktop + mobile), Quote — Explained (desktop + mobile),
  Favourites (list, empty, loading, error, mobile), Quote not found,
  Home — No image, Home — Minimal, Quote — Explanation unavailable.
- Foundations + Components boards; library assets: 9 colour styles, a `Button`
  variant set (Default/Hover/Disabled) and a `Quote Card` component.
- Type: Ibarra Real Nova (serif) + Golos Text (sans); palette from the Tailwind
  stone/amber classes in `apps/web/src/styles.css`.
- Constraints: Penpot boards cannot nest (sub-components are groups); the plugin
  API cannot create projects/files; images are hotlinked from Unsplash.

## 8. External services notes

- **Unsplash API is free.** Register at `unsplash.com/oauth/applications`; the
  Access Key (`Client-ID`, *not* the secret) goes in `UNSPLASH_ACCESS_KEY`.
  Demo mode is 50 req/hour; production (after review) is 1000 req/hour.
  Hotlinking, attribution with `utm_*`, and key confidentiality are required by
  the API guidelines; image requests to `images.unsplash.com` don't count
  against the rate limit. The SQLite image cache protects the limit.
- **DeepSeek** is OpenAI-compatible; `DEEPSEEK_MODEL` defaults to
  `deepseek-flash`. Explanations are cached by `(quote_id, model, promptVersion)`.
