import { parseVFSPath } from '$lib/vfs/types';

const GLSL_EXTENSION = '.glsl';

const hasExtension = (path: string): boolean => {
  const filename = path.split('/').pop() ?? '';

  return filename.includes('.');
};

function normalizeSegments(segments: string[], namespace: 'patch' | 'user'): string[] {
  const normalized: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') continue;

    if (segment === '..') {
      if (normalized.length === 0) {
        throw new Error(`GLSL #include cannot escape ${namespace}://`);
      }

      normalized.pop();
      continue;
    }

    normalized.push(segment);
  }

  return normalized;
}

export function resolveVfsIncludeCandidates(
  specifier: string,
  importerPath: string = 'patch://'
): string[] {
  const explicit = parseVFSPath(specifier);
  const importer = parseVFSPath(importerPath);

  let namespace: 'patch' | 'user';
  let segments: string[];

  if (explicit) {
    if (explicit.namespace === 'obj') {
      throw new Error('GLSL #include does not support obj:// paths');
    }

    namespace = explicit.namespace;
    segments = explicit.segments;
  } else {
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
      throw new Error(`Unsupported #include path: "${specifier}"`);
    }

    if (!importer || importer.namespace === 'obj') {
      throw new Error(`Relative GLSL #include requires a Patch or User importer: ${importerPath}`);
    }

    namespace = importer.namespace;
    segments = [...importer.segments.slice(0, -1), ...specifier.split('/')];
  }

  const normalized = normalizeSegments(segments, namespace);
  const exact = `${namespace}://${normalized.join('/')}`;

  return hasExtension(exact) ? [exact] : [exact, `${exact}${GLSL_EXTENSION}`];
}

export const isEditablePatchGlslPath = (path: string): boolean =>
  /^patch:\/\/.+\.(?:gl|glsl|frag|vert|glslf|glslv)$/.test(path);
