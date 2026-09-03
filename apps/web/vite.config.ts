import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  /*
   * `@veyra/contracts` builds to CommonJS because the API is a CommonJS Nest
   * app. The browser can't load that, and Vite only pre-bundles workspace
   * packages it finds during the scan — so the first *runtime* import from
   * contracts (as opposed to a type-only one, which is erased) fails with
   * "exports is not defined". Naming it here makes the conversion explicit.
   */
  optimizeDeps: {
    include: ['@veyra/contracts'],
  },
  server: {
    // 5173 by default, but overridable so a second checkout (or a second
    // agent session) can run its own dev server without a port clash.
    port: Number(process.env.PORT) || 5173,
    // The API sets an httpOnly session cookie. Proxying /api through the dev
    // server keeps the app same-origin, so the cookie needs no SameSite=None.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
});
