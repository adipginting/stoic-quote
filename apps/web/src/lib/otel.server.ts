import '@tanstack/react-start/server-only'

import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'

process.env.OTEL_SERVICE_NAME ??= 'stoic-quote-web'

// Opt-in: only start the SDK when an OTLP endpoint is configured and the SDK
// has not been explicitly disabled. Otherwise this module is a no-op, so local
// dev, tests and the dev overlay stay clean without any extra configuration.
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim()
const enabled = process.env.OTEL_SDK_DISABLED !== 'true' && Boolean(endpoint)

let sdk: NodeSDK | undefined

if (enabled) {
  sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    logRecordProcessors: [
      new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() }),
    ],
    instrumentations: [
      new HttpInstrumentation(),
      new UndiciInstrumentation(),
      new PinoInstrumentation(),
    ],
  })

  sdk.start()

  process.on('SIGTERM', () => {
    void sdk?.shutdown()
  })
}

export { sdk }
