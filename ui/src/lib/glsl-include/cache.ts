/**
 * In-memory cache for resolved GLSL #include sources.
 *
 * URL fetches are cached permanently (cleared on page reload).
 * NPM and VFS reads are also cached to avoid redundant resolution.
 */

import type { IncludeResolver } from './preprocessor';

export type CachedIncludeResolver = IncludeResolver & {
  _cache: Map<string, string>;
  _invalidateVfs: (path?: string) => void;
};

export function createCachedResolver(base: IncludeResolver): CachedIncludeResolver {
  const cache = new Map<string, string>();
  const inflight = new Map<string, Promise<string>>();
  const generations = new Map<string, number>();

  function dedup(key: string, fetch: () => Promise<string>): Promise<string> {
    const cached = cache.get(key);

    if (cached !== undefined) {
      return Promise.resolve(cached);
    }

    const pending = inflight.get(key);
    if (pending) return pending;

    const generation = generations.get(key) ?? 0;

    const promise = fetch().then(
      (content) => {
        if ((generations.get(key) ?? 0) === generation) cache.set(key, content);
        if (inflight.get(key) === promise) inflight.delete(key);

        return content;
      },
      (error) => {
        if (inflight.get(key) === promise) inflight.delete(key);

        throw error;
      }
    );

    inflight.set(key, promise);

    return promise;
  }

  return {
    _cache: cache,
    _invalidateVfs(path?: string): void {
      const prefix = 'vfs:';

      const keys = path
        ? [`${prefix}${path}`]
        : new Set(
            [...cache.keys(), ...inflight.keys(), ...generations.keys()].filter((key) =>
              key.startsWith(prefix)
            )
          );

      for (const key of keys) {
        cache.delete(key);
        inflight.delete(key);
        generations.set(key, (generations.get(key) ?? 0) + 1);
      }
    },

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
 */
export function clearVfsCache(resolver: CachedIncludeResolver, path?: string): void {
  resolver._invalidateVfs(path);
}
