import { defineConfig } from 'vite';

// All builds use relative paths so the game works from any folder / CDN / iframe
// (required by Poki, CrazyGames, GameDistribution and most other web portals).
export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1500,
    sourcemap: false,
    reportCompressedSize: true,
  },
  server: { host: true, port: 5173 },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'],
    environment: 'node',
  },
} as any);
