/**
 * Combined GLSL #include resolver for the render worker.
 *
 * Wires together NPM (CDN), VFS (main-thread messaging), and URL (fetch)
 * resolution behind a single cached IncludeResolver interface.
 */

import type { IncludeResolver } from './preprocessor';
import { createCachedResolver, type CachedIncludeResolver } from './cache';
import { resolveNpmPackage } from './npm-resolver';
import { resolveVfsText } from './vfs-resolver';

/** Shared cache across all worker resolvers so multiple nodes reuse fetched includes. */
let sharedResolver: CachedIncludeResolver | null = null;

function getSharedResolver(): CachedIncludeResolver {
  if (sharedResolver) return sharedResolver;

  sharedResolver = createCachedResolver({
    resolveNpm: resolveNpmPackage,
    // VFS resolution needs nodeId, so it's overridden per-call in createWorkerResolver
    resolveVfs: () => {
      throw new Error('resolveVfs must be called through a per-node resolver');
    },
    resolveUrl: async (url) => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch #include "${url}": ${response.status} ${response.statusText}`
        );
      }

      return response.text();
    }
  });

  return sharedResolver;
}

export function createWorkerResolver(nodeId: string): IncludeResolver {
  const shared = getSharedResolver();

  return {
    resolveNpm: (packagePath) => shared.resolveNpm(packagePath),
    resolveVfs: (vfsPath) => resolveVfsText(nodeId, vfsPath),
    resolveUrl: (url) => shared.resolveUrl(url)
  };
}

/** Access the shared resolver for cache management (e.g. clearing VFS entries). */
export function getSharedWorkerResolver(): CachedIncludeResolver | null {
  return sharedResolver;
}
