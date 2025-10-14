import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.spec.tsx'],
    server: {
      deps: {
        inline: ['react-native', 'react-native-paper']
      }
    }
  }
});
