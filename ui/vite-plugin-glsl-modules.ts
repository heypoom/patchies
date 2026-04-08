/**
 * Vite plugin that serves GLSL module files (e.g. lygia) from node_modules.
 *
 * - Dev: serves files via Vite middleware at /glsl-modules/lygia/*
 * - Build: copies files into the static output so they're available as static assets
 *
 * This avoids CDN rate limits and enables offline use.
 */

import { type Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { accessSync } from 'fs';

const GLSL_MODULES_PREFIX = '/glsl-modules/';

const GLSL_EXTENSIONS = new Set([
  '.gl',
  '.glsl',
  '.frag',
  '.vert',
  '.glslf',
  '.glslv',
  '.hlsl',
  '.wgsl'
]);

/** Resolve a package directory inside node_modules relative to the project root. */
function getNodeModulesPath(root: string, packageName: string): string {
  return join(root, 'node_modules', packageName);
}

/**
 * Dev middleware plugin: serves GLSL files from node_modules at /glsl-modules/*.
 */
export function glslModulesDev(): Plugin {
  let projectRoot = '';

  return {
    name: 'glsl-modules-dev',
    configResolved(config) {
      projectRoot = config.root;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(GLSL_MODULES_PREFIX)) return next();

        const modulePath = req.url.slice(GLSL_MODULES_PREFIX.length);
        const parts = modulePath.split('/');
        let packageName: string;
        let filePath: string;

        // Scoped packages start with '@' and need two segments for the package name
        if (parts[0].startsWith('@') && parts.length > 2) {
          packageName = `${parts[0]}/${parts[1]}`;
          filePath = parts.slice(2).join('/');
        } else {
          packageName = parts[0];
          filePath = parts.slice(1).join('/');
        }

        if (!filePath) {
          res.statusCode = 400;
          res.end('Missing file path');
          return;
        }

        // Only serve known GLSL extensions
        const ext = filePath.slice(filePath.lastIndexOf('.'));
        if (!GLSL_EXTENSIONS.has(ext)) {
          res.statusCode = 403;
          res.end('Not a GLSL file');
          return;
        }

        const basePath = getNodeModulesPath(projectRoot, packageName);
        const fullPath = join(basePath, filePath);

        // Prevent path traversal
        if (!fullPath.startsWith(basePath)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        readFile(fullPath, 'utf-8')
          .then((content) => {
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.end(content);
          })
          .catch(() => {
            res.statusCode = 404;
            res.end(`File not found: ${modulePath}`);
          });
      });
    }
  };
}

/**
 * Build plugin: copies GLSL package files into the static output.
 */
export function glslModulesCopy(): ReturnType<typeof viteStaticCopy> | Plugin {
  const lygiaPath = join(process.cwd(), 'node_modules', 'lygia');

  // Check synchronously if lygia exists
  try {
    accessSync(lygiaPath);
  } catch {
    return { name: 'glsl-modules-copy-noop' };
  }

  return viteStaticCopy({
    structured: true,
    targets: [
      {
        src: join(lygiaPath, '**', '*.glsl'),
        dest: 'glsl-modules/lygia'
      }
    ]
  });
}
