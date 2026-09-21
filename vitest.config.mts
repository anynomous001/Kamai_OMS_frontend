import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Frontend test runner — Vitest + React Testing Library + jsdom.
//
// Chosen over a Playwright/browser suite because everything under test
// here (page.tsx's login-screen logic) is plain component
// state/wiring — mocking the network boundary (lib/api, lib/auth) and
// Google's window.google callback is enough to exercise it, with no real
// browser or real Google OAuth involved (and no automated tool can
// safely drive a real Google consent screen anyway). jsdom is also the
// lightest environment that still gives framer-motion's DOM APIs to work
// against, unlike a pure logic-only runner.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
