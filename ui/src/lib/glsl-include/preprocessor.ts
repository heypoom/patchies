/**
 * GLSL #include preprocessor.
 *
 * Resolves #include directives from four sources:
 *   - NPM packages:    #include <lygia/generative/snoise>
 *   - Relative (npm):  #include "../math/mod289.glsl"  (within npm files)
 *   - VFS files:       #include "user://my-shaders/foo.glsl"
 *   - URLs:            #include "https://raw.githubusercontent.com/..."
 *
 * Resolution is recursive with circular-include detection.
 */

export interface IncludeResolver {
  resolveNpm(packagePath: string): Promise<string>;
  resolveVfs(vfsPath: string): Promise<string>;
  resolveUrl(url: string): Promise<string>;
}

const INCLUDE_RE = /^[ \t]*#include\s+(?:<([^>]+)>|"([^"]+)")/gm;

const MAX_DEPTH = 32;

function ensureGlslExtension(path: string): string {
  const lastSegment = path.split('/').pop() ?? '';
  if (lastSegment.includes('.')) return path;

  return `${path}.glsl`;
}

/**
 * Resolve a relative path against a base directory path.
 * e.g. resolveRelativePath("lygia/generative/", "../math/mod289.glsl")
 *      → "lygia/math/mod289.glsl"
 */
function resolveRelativePath(basePath: string, relativePath: string): string {
  const parts = basePath.split('/').filter(Boolean);
  const relParts = relativePath.split('/');

  for (const part of relParts) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }

  return parts.join('/');
}

/**
 * Extract the directory portion of a path.
 * e.g. "lygia/generative/snoise.glsl" → "lygia/generative/"
 */
function dirname(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? '' : path.slice(0, lastSlash + 1);
}

/**
 * Resolve all #include directives in a GLSL source string.
 *
 * @param source - GLSL source code potentially containing #include directives
 * @param resolver - Strategy for resolving includes from different sources
 * @param seen - Set of already-resolved paths (for circular detection)
 * @param depth - Current recursion depth
 * @param npmBasePath - Base path for resolving relative includes within npm packages
 */
export async function processIncludes(
  source: string,
  resolver: IncludeResolver,
  seen: Set<string> = new Set(),
  depth: number = 0,
  npmBasePath: string = ''
): Promise<string> {
  if (depth > MAX_DEPTH) {
    throw new Error(`#include recursion depth exceeded (max ${MAX_DEPTH})`);
  }

  // Collect all matches first (regex is stateful)
  const matches: Array<{
    fullMatch: string;
    index: number;
    npmPath: string | undefined;
    quotedPath: string | undefined;
  }> = [];

  let match: RegExpExecArray | null;

  // Reset lastIndex for safety
  INCLUDE_RE.lastIndex = 0;

  while ((match = INCLUDE_RE.exec(source)) !== null) {
    matches.push({
      fullMatch: match[0],
      index: match.index,
      npmPath: match[1],
      quotedPath: match[2]
    });
  }

  if (matches.length === 0) return source;

  // Resolve all includes in parallel
  const resolutions = await Promise.all(
    matches.map(async ({ npmPath, quotedPath }) => {
      const { resolvedPath, content, nextBasePath } = await resolveInclude(
        resolver,
        npmPath,
        quotedPath,
        npmBasePath
      );

      if (seen.has(resolvedPath)) {
        throw new Error(`Circular #include detected: ${resolvedPath}`);
      }

      const innerSeen = new Set(seen);
      innerSeen.add(resolvedPath);

      // Recursively resolve nested includes, passing the base path for relative resolution
      return processIncludes(content, resolver, innerSeen, depth + 1, nextBasePath);
    })
  );

  // Rebuild source by splicing resolved content at each match position
  const parts: string[] = [];
  let prevEnd = 0;

  for (let i = 0; i < matches.length; i++) {
    parts.push(source.slice(prevEnd, matches[i].index));
    parts.push(resolutions[i]);
    prevEnd = matches[i].index + matches[i].fullMatch.length;
  }

  parts.push(source.slice(prevEnd));
  const result = parts.join('');

  return result;
}

async function resolveInclude(
  resolver: IncludeResolver,
  npmPath: string | undefined,
  quotedPath: string | undefined,
  npmBasePath: string
): Promise<{ resolvedPath: string; content: string; nextBasePath: string }> {
  // npm package imports: #include <lygia/generative/snoise>
  if (npmPath) {
    const resolved = ensureGlslExtension(npmPath);
    const content = await resolver.resolveNpm(resolved);

    return { resolvedPath: `npm:${resolved}`, content, nextBasePath: dirname(resolved) };
  }

  if (quotedPath) {
    // virtual filesystem imports
    if (quotedPath.startsWith('user://')) {
      const content = await resolver.resolveVfs(quotedPath);

      return { resolvedPath: `vfs:${quotedPath}`, content, nextBasePath: '' };
    }

    // HTTP imports
    if (quotedPath.startsWith('https://') || quotedPath.startsWith('http://')) {
      const content = await resolver.resolveUrl(quotedPath);

      return { resolvedPath: `url:${quotedPath}`, content, nextBasePath: '' };
    }

    // Relative imports within npm packages: #include "../math/mod289.glsl" or #include "mod289.glsl"
    if (npmBasePath) {
      const resolved = ensureGlslExtension(resolveRelativePath(npmBasePath, quotedPath));
      const content = await resolver.resolveNpm(resolved);

      return { resolvedPath: `npm:${resolved}`, content, nextBasePath: dirname(resolved) };
    }

    throw new Error(
      `Unsupported #include path: "${quotedPath}". Use <pkg/path> for npm, user:// for VFS, or https:// for URLs.`
    );
  }

  throw new Error('Invalid #include directive');
}
