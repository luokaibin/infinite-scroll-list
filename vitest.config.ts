import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'contract',
    environment: 'node',
    include: ['packages/*/test/contract/**/*.test.ts'],
  },
});
