import { defineConfig } from 'vitest/config';

// Relative base so the build works under https://<user>.github.io/<repo>/
export default defineConfig({
  base: './',
  // Three.js alone is ~500 kB; one bundle is fine for the demo.
  build: { chunkSizeWarningLimit: 900 },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
