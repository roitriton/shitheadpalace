import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    env: {
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'test-secret-that-is-long-enough-for-jwt',
      JWT_EXPIRES_IN: '1h',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
