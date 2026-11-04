// Custom server entry for TanStack Start.
//
// Importing the OpenTelemetry bootstrap first guarantees the SDK registers its
// instrumentations (including fetch/undici propagation) before the app modules
// load. Everything else is delegated to the default Start server entry.
import './lib/otel.server'

import serverEntry from '@tanstack/react-start/server-entry'

export default serverEntry
