import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // tsconfig.json sets "jsx": "preserve" (Next's own SWC does the actual
  // transform at build time), which esbuild doesn't understand and falls
  // back to the classic transform requiring `React` in scope. Force the
  // automatic runtime here so component tests don't need `import React`.
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    // Component tests (.test.tsx) render with React Testing Library and need
    // a DOM, so they run under jsdom; plain .test.ts unit tests (lib/API
    // route logic) stay on the lighter/faster 'node' environment above.
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
