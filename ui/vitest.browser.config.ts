/// <reference types="@vitest/browser/providers/playwright" />
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  server: { preTransformRequests: false },
  optimizeDeps: { include: ['regl'] },
  plugins: [svelte()],
  resolve: {
    alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) }
  },
  test: {
    include: ['src/**/*.svelte.test.ts', 'src/**/*.browser.test.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      instances: [{ browser: 'chromium', launch: { channel: process.env.PLAYWRIGHT_CHANNEL } }]
    }
  }
});
