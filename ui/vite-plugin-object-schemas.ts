import { execSync } from 'child_process';
import { join } from 'path';
import type { Plugin } from 'vite';

const WATCH_DIRS = [
  'src/lib/audio/v2/nodes',
  'src/lib/audio/native-dsp/nodes',
  'src/lib/objects/v2/nodes'
];

function runGenerator(root: string): void {
  try {
    execSync('bun scripts/run-generate-schemas.ts', {
      cwd: root,
      stdio: 'inherit',
      timeout: 30000
    });
  } catch (error) {
    console.error('[object-schemas] Generation failed:', error);
  }
}

/**
 * Vite plugin that generates object schemas at build time.
 *
 * Extracts static metadata from V2 audio/control node classes and writes
 * a TypeScript file with TypeBox Type.xxx() calls. This decouples the
 * schema registry from the heavy node class dependency tree, enabling
 * prerendering of /docs routes.
 */
export function objectSchemasPlugin(): Plugin {
  let root: string;

  return {
    name: 'object-schemas',

    configResolved(config) {
      root = config.root;
    },

    buildStart() {
      runGenerator(root);
    },

    configureServer(server) {
      for (const dir of WATCH_DIRS) {
        server.watcher.add(join(root, dir));
      }

      const handleChange = (path: string) => {
        const isRelevant = WATCH_DIRS.some((dir) => path.includes(dir)) && path.endsWith('.ts');
        if (isRelevant) {
          runGenerator(root);
        }
      };

      server.watcher.on('add', handleChange);
      server.watcher.on('change', handleChange);
      server.watcher.on('unlink', handleChange);
    }
  };
}
