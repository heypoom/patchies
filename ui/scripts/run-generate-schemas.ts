/**
 * Thin runner that bootstraps a minimal Vite server to resolve $lib aliases,
 * then loads and executes the schema generator via ssrLoadModule.
 *
 * Replaces the previous `vite-node scripts/generate-object-schemas.ts` approach.
 */

import { createServer } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const server = await createServer({
  configFile: false,
  root,
  server: { middlewareMode: true },
  resolve: {
    alias: {
      $lib: resolve(root, 'src/lib'),
      $workers: resolve(root, 'src/workers')
    }
  },
  optimizeDeps: { noDiscovery: true }
});

try {
  await server.ssrLoadModule('./scripts/generate-object-schemas.ts');
} finally {
  await server.close();
}
