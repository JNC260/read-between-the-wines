import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

// Specs that talk to a real Postgres (npx nx test-db backend). Kept apart
// from vitest.config.mts so the regular tests don't need Docker running.
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/backend-db',
  plugins: [nxViteTsPaths()],
  test: {
    name: 'backend-db',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.db.spec.ts'],
    globalSetup: ['src/test/db-global-setup.ts'],
    setupFiles: ['src/test/db-setup.ts'],
    // One database, so one spec file at a time.
    fileParallelism: false,
    reporters: ['default'],
  },
}));
