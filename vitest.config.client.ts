import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/client/**/*.test.ts', 'tests/client/**/*.spec.ts'],
    exclude: ['tests/e2e/**/*', 'tests/server/**/*', 'node_modules/**/*'],
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: ['tests/client/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/client',
      include: [
        'src/client/stores/**/*.ts',
        'src/client/composables/**/*.ts',
        'src/client/components/**/*.vue',
        'src/client/pages/**/*.vue',
        'src/client/router/**/*.ts',
        'src/client/services/**/*.ts',
      ],
      exclude: [
        'src/client/**/*.d.ts',
        'src/client/**/*.test.ts',
        'src/client/**/*.spec.ts',
        'src/client/types/**/*',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
    deps: {
      inline: ['primevue', 'pinia', 'vue-router'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@server': path.resolve(__dirname, './src/server'),
      '@client': path.resolve(__dirname, './src/client'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
});
