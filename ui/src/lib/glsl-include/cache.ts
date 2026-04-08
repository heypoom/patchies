/**
 * In-memory cache for resolved GLSL #include sources.
 *
 * URL fetches are cached permanently (cleared on page reload).
 * NPM and VFS reads are also cached to avoid redundant resolution.
 */

import type { IncludeResolver } from './preprocessor';

export type CachedIncludeResolver = IncludeResolver & { _cache: Map<string, string> };

export function createCachedResolver(base: IncludeResolver): CachedIncludeResolver {
  const cache = new Map<string, string>();

  return {
    _cache: cache,

    async resolveNpm(packagePath: string): Promise<string> {
      const key = `npm:${packagePath}`;
      const cached = cache.get(key);
      if (cached !== undefined) return cached;

      const content = await base.resolveNpm(packagePath);
      cache.set(key, content);
      return content;
    },

    async resolveVfs(vfsPath: string): Promise<string> {
      const key = `vfs:${vfsPath}`;
      const cached = cache.get(key);
      if (cached !== undefined) return cached;

      const content = await base.resolveVfs(vfsPath);
      cache.set(key, content);
      return content;
    },

    async resolveUrl(url: string): Promise<string> {
      const key = `url:${url}`;
      const cached = cache.get(key);
      if (cached !== undefined) return cached;

      const content = await base.resolveUrl(url);
      cache.set(key, content);
      return content;
    }
  };
}

/** Clear VFS entries from cache (call when VFS files change). */
export function clearVfsCache(resolver: CachedIncludeResolver): void {
  for (const key of resolver._cache.keys()) {
    if (key.startsWith('vfs:')) resolver._cache.delete(key);
  }
}
