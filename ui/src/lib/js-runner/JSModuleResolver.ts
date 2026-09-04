import { parseVFSPath } from '$lib/vfs/types';

export type JSModuleResolutionCategory =
  | 'patch-root'
  | 'relative-patch'
  | 'explicit-vfs'
  | 'npm'
  | 'url';

export type JSModuleResolutionErrorDetails = {
  specifier: string;
  importer: string;
  attemptedPaths: string[];
  attemptedCategories: JSModuleResolutionCategory[];
};

export class JSModuleResolutionError extends Error {
  readonly code = 'JS_MODULE_NOT_FOUND';

  constructor(readonly details: JSModuleResolutionErrorDetails) {
    const attempted =
      details.attemptedPaths.length > 0 ? ` Tried: ${details.attemptedPaths.join(', ')}.` : '';

    super(
      `Cannot resolve JavaScript module "${details.specifier}" from "${details.importer}".${attempted}`
    );
    this.name = 'JSModuleResolutionError';
  }
}

export type JSModuleResolution =
  | { id: string; category: 'npm' | 'url'; external: true }
  | {
      id: string;
      category: 'patch-root' | 'relative-patch' | 'explicit-vfs';
      external: false;
    };

type VfsModuleLoader = (path: string, importerId: string) => Promise<string>;

const hasWrittenJavaScriptExtension = (path: string): boolean => /\.(?:js|mjs)$/.test(path);

const withJavaScriptExtension = (path: string): string =>
  hasWrittenJavaScriptExtension(path) ? path : `${path}.js`;

function normalizeVfsPath(
  namespace: 'patch' | 'user',
  segments: string[],
  specifier: string,
  importer: string
): string {
  const normalized: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') continue;

    if (segment === '..') {
      if (normalized.length === 0) {
        throw new JSModuleResolutionError({
          specifier,
          importer,
          attemptedPaths: [],
          attemptedCategories: [parseVFSPath(specifier) ? 'explicit-vfs' : 'relative-patch']
        });
      }

      normalized.pop();
      continue;
    }

    normalized.push(segment);
  }

  if (normalized.length === 0) {
    throw new JSModuleResolutionError({
      specifier,
      importer,
      attemptedPaths: [],
      attemptedCategories: [parseVFSPath(specifier) ? 'explicit-vfs' : 'relative-patch']
    });
  }

  return `${namespace}://${normalized.join('/')}`;
}

function getVfsCandidates(specifier: string, importer: string): string[] | null {
  const explicit = parseVFSPath(specifier);

  if (explicit) {
    if (explicit.namespace === 'obj') return null;

    const exact = normalizeVfsPath(explicit.namespace, explicit.segments, specifier, importer);

    return [withJavaScriptExtension(exact)];
  }

  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null;

  const parsedImporter = parseVFSPath(importer);
  const namespace = parsedImporter?.namespace === 'user' ? 'user' : 'patch';
  const parentSegments =
    parsedImporter && parsedImporter.namespace !== 'obj'
      ? parsedImporter.segments.slice(0, -1)
      : [];
  const exact = normalizeVfsPath(
    namespace,
    [...parentSegments, ...specifier.split('/')],
    specifier,
    importer
  );

  return [withJavaScriptExtension(exact)];
}

function getPatchRootCandidate(specifier: string, importer: string): string {
  if (
    specifier.startsWith('/') ||
    specifier.includes('\\') ||
    specifier.split('/').some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new JSModuleResolutionError({
      specifier,
      importer,
      attemptedPaths: [],
      attemptedCategories: ['patch-root']
    });
  }

  return `patch://${withJavaScriptExtension(specifier)}`;
}

/** Resolves every JSRunner import against one canonical module registry. */
export class JSModuleResolver {
  private vfsModuleLoader: VfsModuleLoader | null = null;

  constructor(private modules: Map<string, string>) {}

  setVfsModuleLoader(loader: VfsModuleLoader): void {
    this.vfsModuleLoader = loader;
  }

  async resolve(
    specifier: string,
    importer: string,
    requesterId: string = importer
  ): Promise<JSModuleResolution> {
    if (specifier.startsWith('npm:')) {
      return { id: specifier, category: 'npm', external: true };
    }

    if (specifier.startsWith('http://') || specifier.startsWith('https://')) {
      return { id: specifier, category: 'url', external: true };
    }

    const parsedSpecifier = parseVFSPath(specifier);
    if (parsedSpecifier?.namespace === 'obj') {
      throw new JSModuleResolutionError({
        specifier,
        importer,
        attemptedPaths: [specifier],
        attemptedCategories: ['explicit-vfs']
      });
    }

    const vfsCandidates = getVfsCandidates(specifier, importer);
    if (vfsCandidates) {
      const resolved = await this.findVfsCandidate(vfsCandidates, requesterId);

      if (resolved) {
        return {
          id: resolved,
          category: parseVFSPath(specifier) ? 'explicit-vfs' : 'relative-patch',
          external: false
        };
      }

      throw new JSModuleResolutionError({
        specifier,
        importer,
        attemptedPaths: vfsCandidates,
        attemptedCategories: [parseVFSPath(specifier) ? 'explicit-vfs' : 'relative-patch']
      });
    }

    const patchPath = getPatchRootCandidate(specifier, importer);

    if (this.modules.has(patchPath)) {
      return { id: patchPath, category: 'patch-root', external: false };
    }

    throw new JSModuleResolutionError({
      specifier,
      importer,
      attemptedPaths: [patchPath],
      attemptedCategories: ['patch-root']
    });
  }

  resolveKnown(specifier: string, importer: string): string | null {
    if (
      specifier.startsWith('npm:') ||
      specifier.startsWith('http://') ||
      specifier.startsWith('https://')
    ) {
      return null;
    }

    const vfsCandidates = getVfsCandidates(specifier, importer);
    if (vfsCandidates) {
      return vfsCandidates.find((candidate) => this.modules.has(candidate)) ?? null;
    }

    let patchPath: string;

    try {
      patchPath = getPatchRootCandidate(specifier, importer);
    } catch {
      return null;
    }

    return this.modules.has(patchPath) ? patchPath : null;
  }

  async load(id: string, requesterId: string): Promise<string | null> {
    if (id.startsWith('user://')) {
      return this.loadVfsModule(id, requesterId);
    }

    return this.modules.get(id) ?? null;
  }

  private async findVfsCandidate(
    candidates: string[],
    requesterId: string
  ): Promise<string | null> {
    for (const candidate of candidates) {
      if (candidate.startsWith('patch://') && this.modules.has(candidate)) return candidate;

      if (candidate.startsWith('user://')) {
        try {
          await this.loadVfsModule(candidate, requesterId);

          return candidate;
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  private async loadVfsModule(path: string, importer: string): Promise<string> {
    if (!this.vfsModuleLoader) throw new Error(`No VFS module loader is available for ${path}`);

    const source = await this.vfsModuleLoader(path, importer);
    this.modules.set(path, source);

    return source;
  }
}
