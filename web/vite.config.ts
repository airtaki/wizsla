import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ command, mode }) => {
  // The API's port, from the backend's .env (one level up). Read for the dev
  // server only: loadEnv also passes that file's NODE_ENV on to Vite, which
  // would turn a production build into a development one.
  const { PORT = '3000' } =
    command === 'serve' ? loadEnv(mode, '..', 'PORT') : {};

  return {
    // Served by the API under /app (see src/web.ts in the backend).
    base: '/app/',
    plugins: [react(), tailwindcss()],
    server: {
      // In development everything outside /app goes to the API, so the app
      // calls it on its own origin, as in production.
      proxy: {
        '^/(?!app(/|$))': { target: `http://127.0.0.1:${PORT}` },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      restoreMocks: true,
      unstubGlobals: true,
    },
  };
});
