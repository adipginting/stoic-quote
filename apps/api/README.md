# Stoic Quote API

NestJS API serving quotes from four public-domain Stoic works — Marcus Aurelius' *Meditations*, Seneca's *Dialogues*, Epictetus' *Enchiridion* and *Discourses* — extracted from the Standard Ebooks sources kept as git submodules in this directory.

## Endpoints

v2 JSON (see Swagger at `/api-doc`):

- `GET /v2/meta` — quote count, capabilities (`explain`, `images`), work slugs
- `GET /v2/quotes/random?tag=&work=&minLength=&maxLength=`
- `GET /v2/quotes/daily?date=YYYY-MM-DD` — deterministic per date
- `GET /v2/quotes/:id`
- `GET /v2/quotes/:id/explanation` — DeepSeek, cached in SQLite; 503 without `DEEPSEEK_API_KEY`
- `GET /v2/quotes/:id/image` — Unsplash photo + credit, cached in SQLite; 404 without `UNSPLASH_ACCESS_KEY`
- `GET|POST|DELETE /v2/favourites` — anonymous, keyed by the `x-visitor-id` header

v1 plain-text endpoints are kept frozen for existing consumers: `GET /`, `/aurelius`, `/seneca`, `/epictetus-theenchiridion`, `/epictetus-discourses`. `min`/`max` on `/` keep the original >100 validation and 417 behaviour. (The old `epictetus-theenchiridion` route typo is fixed.)

Structured responses (v2) exist because the old string format could not carry a stable quote id, license the web app's deep links, or expose tags and attribution separately.

## Dataset

`pnpm extract` regenerates `data/quotes.json` deterministically from the submodules (commit the result; CI checks it is fresh). Every quote carries a stable id, author, work, section, translation and 1–3 tags (stoicism, virtue, death, time, …) used for image selection.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` | Directory containing `quotes.json` |
| `SQLITE_PATH` | `./.data/stoic.db` | Favourites + explanation/image caches |
| `DEEPSEEK_API_KEY` | — | Enables explanations |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek-compatible endpoint |
| `DEEPSEEK_MODEL` | `deepseek-flash` | Explanation model |
| `UNSPLASH_ACCESS_KEY` | — | Enables imagery |
| `LOG_LEVEL` | `info` (prod), `debug` (dev) | Pino log level |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | Enables OTLP trace + log export when set |
| `OTEL_EXPORTER_OTLP_HEADERS` | — | OTLP auth headers (e.g. Grafana Cloud `Authorization=Basic …`) |

## Observability

`src/otel.ts` is imported first in `main.ts` and starts the OpenTelemetry SDK
(HTTP + undici + pino instrumentation, OTLP trace/log exporters) only when
`OTEL_EXPORTER_OTLP_ENDPOINT` is set. `nestjs-pino` (configured in
`src/logger.config.ts`) provides per-request logs; log lines carry
`trace_id`/`span_id`, and `x-visitor-id`/authorization headers are redacted.

## Development

```bash
pnpm --filter @stoic-quote/api dev          # watch mode, :3000
pnpm --filter @stoic-quote/api test         # unit tests
pnpm --filter @stoic-quote/api test:e2e     # e2e tests (fixture dataset)
pnpm --filter @stoic-quote/api check-types
pnpm --filter @stoic-quote/api build        # → dist/main.js
```

Tests run against the fixture at `test/fixtures/quotes.json`, so they need no network or API keys. SQLite state lives outside the repository by default; set `SQLITE_PATH` to isolate it.
