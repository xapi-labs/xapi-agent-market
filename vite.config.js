import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import deployment from './vercel.json';

// Keep local development on the exact same upstreams as the deployed site.
const proxy = Object.fromEntries(deployment.rewrites
  .filter(({ destination }) => destination.startsWith('https://'))
  .map(({ source, destination }) => {
    const prefix = source.replace('/:path*', '');
    const upstream = new URL(destination.replace('/:path*', ''));
    return [prefix, {
      target: upstream.origin,
      changeOrigin: true,
      rewrite: path => upstream.pathname.replace(/\/$/, '') + path.slice(prefix.length),
    }];
  }));

export default defineConfig({
  plugins: [react()],
  server: { proxy, strictPort: true },
  build: { target: 'es2022' },
  test: { environment: 'jsdom', restoreMocks: true },
});
