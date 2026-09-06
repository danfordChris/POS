import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    // `test` runs unit specs and integration (e2e) specs together.
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
  },
});
