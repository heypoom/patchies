/**
 * Combined GLSL #include resolver for the render worker.
 *
 * Wires together NPM (CDN), VFS (main-thread messaging), and URL (fetch)
 * resolution behind a single cached IncludeResolver interface.
 */

import type { IncludeResolver } from './preprocessor';
import { createCachedResolver } from './cache';
import { resolveNpmPackage } from './npm-resolver';
import { resolveVfsText } from './vfs-resolver';

export function createWorkerResolver(nodeId: string): IncludeResolver {
  const base: IncludeResolver = {
    resolveNpm: resolveNpmPackage,
    resolveVfs: (vfsPath) => resolveVfsText(nodeId, vfsPath),
    resolveUrl: async (url) => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch #include "${url}": ${response.status} ${response.statusText}`
        );
      }

      return response.text();
    }
  };

  return createCachedResolver(base);
}
