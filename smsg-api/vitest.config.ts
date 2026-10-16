import { defineConfig } from 'vitest/config';

// DB tests share one local Supabase: run files one at a time.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
