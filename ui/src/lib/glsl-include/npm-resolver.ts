/**
 * NPM package resolver for GLSL #include.
 *
 * Resolves <package/path> includes by fetching from CDN.
 * lygia is the primary use case: #include <lygia/generative/snoise>
 *
 * Resolution order:
 *   1. CDN fetch from lygia.xyz (for lygia) or jsdelivr (for other packages)
 *   2. Cached in memory after first fetch
 */

const LYGIA_CDN = 'https://lygia.xyz';
const JSDELIVR_CDN = 'https://cdn.jsdelivr.net/npm';

export async function resolveNpmPackage(packagePath: string): Promise<string> {
  const url = getModuleCdnUrl(packagePath);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to resolve #include <${packagePath}>: ${response.status} ${response.statusText} (${url})`
    );
  }

  return response.text();
}

function getModuleCdnUrl(packagePath: string): string {
  // lygia has its own CDN with better resolution
  if (packagePath.startsWith('lygia/')) {
    const modulePath = packagePath.slice('lygia/'.length);

    return `${LYGIA_CDN}/${modulePath}`;
  }

  // For other NPM packages, use jsdelivr
  // packagePath is like "pkg-name/path/to/file.glsl"
  return `${JSDELIVR_CDN}/${packagePath}`;
}
