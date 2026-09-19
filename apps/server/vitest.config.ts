import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'cloudflare:workers': resolve(__dirname, 'test/mocks/cloudflare-workers.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
