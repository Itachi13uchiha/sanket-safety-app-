import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// The dev server proxies /v1 to the Sanket API, so the browser only ever talks to one origin
// (no CORS setup needed). Override the target with VITE_API_PROXY_TARGET if the API runs elsewhere.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:4000';
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/v1': { target, changeOrigin: true } },
    },
    preview: { port: 5173, proxy: { '/v1': { target, changeOrigin: true } } },
  };
});
