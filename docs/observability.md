# Observability

Both apps emit structured logs with [pino](https://getpino.io) and can export
OpenTelemetry **traces** and **logs** over OTLP. Telemetry is **opt-in** and
disabled unless an OTLP endpoint is configured.

See [architecture.md](./architecture.md#observability) for how it fits together.

## Enabling

| Variable | Default | Purpose |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | OTLP/HTTP base URL. Setting it turns export on. |
| `OTEL_EXPORTER_OTLP_HEADERS` | — | Auth headers, e.g. `Authorization=Basic <base64>` |
| `LOG_LEVEL` | `info` (prod), `debug` (dev) | pino level |
| `OTEL_SDK_DISABLED` | — | `true` force-disables the SDK even if an endpoint is set |

The endpoint is the base URL only — the OTLP/HTTP exporters append
`/v1/traces` and `/v1/logs` themselves.

### Grafana Cloud

Create an access policy/token with `traces:write` and `logs:write`, then:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-<zone>.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic $(printf '%s:%s' '<instance-id>' '<token>' | base64)"
```

In k3s these live in the `stoic-quote-secrets` secret (all `optional: true`);
see [../k3s/README.md](../k3s/README.md#observability-optional).

### Local collector

Run a collector that prints everything, then point the apps at it:

```yaml
# otel-collector.yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
exporters:
  debug:
    verbosity: detailed
service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [debug]
    logs:
      receivers: [otlp]
      exporters: [debug]
```

```bash
docker run --rm -p 4318:4318 \
  -v "$PWD/otel-collector.yaml:/etc/otelcol/config.yaml" \
  otel/opentelemetry-collector:latest

OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 pnpm dev
```

## What is emitted

- **Traces** — a server span per inbound HTTP request (API and web), plus client
  spans for outbound `fetch` (DeepSeek, Unsplash, and web→api).
- **Logs** — every pino record. The API logs requests via `nestjs-pino`; the web
  app logs API failures via its server-only logger. In the *bundled* web server
  logs are JSON; `pino-pretty` output is only used by `vite dev`.

Service names default to `stoic-quote-api` and `stoic-quote-web`
(`OTEL_SERVICE_NAME` overrides).

## Correlation

The web client span injects a W3C `traceparent` header, and the API's HTTP
instrumentation continues that trace. One user action is therefore one trace
across **web → api → DeepSeek/Unsplash**, and every pino line carries
`trace_id` and `span_id`, so you can pivot between logs and traces:

```json
{"level":30,"msg":"request completed","trace_id":"b59be…","span_id":"53cbd…","res":{"statusCode":200}}
```

Sampling is currently always-on (`parentbased_always_on`); there is no
sampler configuration.

## Redaction

The API removes these from request logs before writing them: `x-visitor-id`,
`authorization`, `cookie`, and `set-cookie`. Request/response bodies, DeepSeek
prompts/outputs and visitor ids are never logged. Trace attributes carry route,
method, status and duration only.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Nothing exported | `OTEL_EXPORTER_OTLP_ENDPOINT` set and reachable; `OTEL_SDK_DISABLED` not `true` |
| 401/403 from the backend | `OTEL_EXPORTER_OTLP_HEADERS` correctly base64-encoded |
| Traces but no logs | the backend's OTLP **logs** pipeline is enabled |
| No logs from the web app | expected on success — it only logs failures |
| Pretty logs missing | `pino-pretty` only applies to `vite dev`, not the built server |
| Nothing reaches the backend from k3s | cluster egress and the secret keys |
