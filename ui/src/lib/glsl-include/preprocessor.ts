/**
 * GLSL #include preprocessor.
 *
 * Resolves #include directives from three sources:
 *   - NPM packages: #include <lygia/generative/snoise>
 *   - VFS files:    #include "user://my-shaders/foo.glsl"
 *   - URLs:         #include "https://raw.githubusercontent.com/..."
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
 * Resolve all #include directives in a GLSL source string.
 *
 * @param source - GLSL source code potentially containing #include directives
 * @param resolver - Strategy for resolving includes from different sources
 * @param seen - Set of already-resolved paths (for circular detection)
 * @param depth - Current recursion depth
 */
export async function processIncludes(
  source: string,
  resolver: IncludeResolver,
  seen: Set<string> = new Set(),
  depth: number = 0
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
      const { resolvedPath, content } = await resolveInclude(resolver, npmPath, quotedPath);

      if (seen.has(resolvedPath)) {
        throw new Error(`Circular #include detected: ${resolvedPath}`);
      }

      const innerSeen = new Set(seen);
      innerSeen.add(resolvedPath);

      // Recursively resolve nested includes
      return processIncludes(content, resolver, innerSeen, depth + 1);
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
  quotedPath: string | undefined
): Promise<{ resolvedPath: string; content: string }> {
  // npm package imports
  if (npmPath) {
    const resolved = ensureGlslExtension(npmPath);
    const content = await resolver.resolveNpm(resolved);

    return { resolvedPath: `npm:${resolved}`, content };
  }

  if (quotedPath) {
    // virtual filesystem imports
    if (quotedPath.startsWith('user://')) {
      const content = await resolver.resolveVfs(quotedPath);

      return { resolvedPath: `vfs:${quotedPath}`, content };
    }

    // HTTP imports
    if (quotedPath.startsWith('https://') || quotedPath.startsWith('http://')) {
      const content = await resolver.resolveUrl(quotedPath);

      return { resolvedPath: `url:${quotedPath}`, content };
    }

    throw new Error(
      `Unsupported #include path: "${quotedPath}". Use user:// for VFS or https:// for URLs.`
    );
  }

  throw new Error('Invalid #include directive');
}
