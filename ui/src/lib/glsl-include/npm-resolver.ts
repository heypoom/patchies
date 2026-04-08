/**
 * NPM package resolver for GLSL #include.
 *
 * Resolves <package/path> includes by:
 *   1. Trying the local /glsl-modules/ path (served by vite-plugin-glsl-modules)
 *   2. Falling back to CDN if the local file is not available
 *
 * Local resolution avoids CDN rate limits and works offline.
 */

const LYGIA_CDN = 'https://lygia.xyz';
const JSDELIVR_CDN = 'https://cdn.jsdelivr.net/npm';

export async function resolveNpmPackage(packagePath: string): Promise<string> {
  // Lygia packages are served locally.
  // This is because Lygia CDN rate-limits at 100 requests per minute.
  // TODO(Poom): once we add a local server, let's add a lygia proxy endpoint.
  if (packagePath.includes('lygia')) {
    try {
      const localUrl = `/glsl-modules/${packagePath}`;
      const response = await fetch(localUrl);

      if (response.ok) {
        return response.text();
      }
    } catch {
      // Local not available, fall through to CDN!
    }
  }

  // Fall back to Lygia CDN
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
  // lygia has its own resolution path.
  if (packagePath.startsWith('lygia/')) {
    const modulePath = packagePath.slice('lygia/'.length);

    return `${LYGIA_CDN}/${modulePath}`;
  }

  // For other NPM packages, use jsdelivr
  // packagePath is like "pkg-name/path/to/file.glsl"
  return `${JSDELIVR_CDN}/${packagePath}`;
}
