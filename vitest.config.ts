import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve('src/main'),
      '@shared': resolve('src/shared'),
      '@': resolve('src/renderer/src')
    }
  },
  // Component tests are .tsx; the root tsconfig is a solution file, so tell esbuild about the runtime.
  esbuild: { jsx: 'automatic' },
  test: {
    // Node by default; a component test opts into jsdom with `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    // One worker per core rather than per thread: at vitest's default (threads - 1) the DuckDB and
    // jsdom files starve each other and cross the 5 s test timeout, a different few each run.
    maxWorkers: '50%',
    // node:sqlite is experimental in Node 22; keep test output clean
    execArgv: ['--disable-warning=ExperimentalWarning']
  }
})
