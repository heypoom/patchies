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
  const inflight = new Map<string, Promise<string>>();

  function dedup(key: string, fetch: () => Promise<string>): Promise<string> {
    const cached = cache.get(key);
    if (cached !== undefined) return Promise.resolve(cached);

    const pending = inflight.get(key);
    if (pending) return pending;

    const promise = fetch().then(
      (content) => {
        cache.set(key, content);
        inflight.delete(key);

        return content;
      },
      (error) => {
        inflight.delete(key);

        throw error;
      }
    );

    inflight.set(key, promise);

    return promise;
  }

  return {
    _cache: cache,

    resolveNpm(packagePath: string): Promise<string> {
      return dedup(`npm:${packagePath}`, () => base.resolveNpm(packagePath));
    },

    resolveVfs(vfsPath: string): Promise<string> {
      return dedup(`vfs:${vfsPath}`, () => base.resolveVfs(vfsPath));
    },

    resolveUrl(url: string): Promise<string> {
      return dedup(`url:${url}`, () => base.resolveUrl(url));
    }
  };
}

/**
 * Clear VFS entries from cache (call when VFS files change).
 *
 * NOTE: Currently unused — VFS file editing is not yet supported, so cached
 * VFS includes can never go stale. Wire this up once in-place VFS file editing
 * is added: on every file-modified event, call this with the shared resolver
 * and trigger updateCode() on any GLSL nodes that reference the changed path.
 */
export function clearVfsCache(resolver: CachedIncludeResolver): void {
  for (const key of resolver._cache.keys()) {
    if (key.startsWith('vfs:')) {
      resolver._cache.delete(key);
    }
  }
}
