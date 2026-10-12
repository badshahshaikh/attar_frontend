import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest config for the frontend. Kept separate from vite.config.js so the
// production build config stays untouched.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: './src/test/setup.js',
    css: false,
    // Only the frontend tests — the repo also contains the backend's own
    // node-based test suite under ms_fragrance_backend/, which vitest must
    // not pick up.
    include: ['src/**/*.test.{js,jsx}'],
  },
});
