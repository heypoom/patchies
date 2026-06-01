/**
 * Combined GLSL #include resolver for main-thread shader users.
 */

import { VirtualFilesystem } from '$lib/vfs';
import { createCachedResolver, type CachedIncludeResolver } from './cache';
import type { IncludeResolver } from './preprocessor';
import { resolveNpmPackage } from './npm-resolver';

let sharedResolver: CachedIncludeResolver | null = null;

export function createBrowserResolver(): IncludeResolver {
  if (sharedResolver) return sharedResolver;

  sharedResolver = createCachedResolver({
    resolveNpm: resolveNpmPackage,
    resolveVfs: async (vfsPath) => {
      const blob = await VirtualFilesystem.getInstance().resolve(vfsPath);

      return blob.text();
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
