import { defineConfig } from 'vitest/config';

// Live end-to-end suite: runs against an already-started server process
// (npm start) talking to the real Atlas DB. Kept separate from the unit
// config so `npm test` never hits the network.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/e2e/**/*.e2e.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Real shared DB — avoid concurrent writers racing on unique email.
    fileParallelism: false,
  },
});
