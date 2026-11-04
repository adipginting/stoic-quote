import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Node by default; DOM-dependent tests opt in with a
    // `// @vitest-environment jsdom` docblock.
    environment: 'node',
    env: { LOG_LEVEL: 'silent', NODE_ENV: 'test' },
  },
})
