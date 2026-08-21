import type { VirtualFilesystem } from './VirtualFilesystem';
import { isVFSFolder } from './types';

export interface MountEntry {
  path: string;
  kind: 'file' | 'directory';
  content?: string;
}

export const MOUNT_FORMAT = 'patchies.vfs-mount.v1';

export const mountPathToVfs = (path: string): string => {
  const [namespace, ...segments] = path.split('/');
  if (
    !['objects', 'patch'].includes(namespace) ||
    segments.some((part) => !part || part === '.' || part === '..' || /[\\\0]/.test(part))
  ) {
    throw new Error(`Invalid mount path: ${path}`);
  }

  return `${namespace === 'objects' ? 'obj' : 'patch'}://${segments.join('/')}`;
};

/** Projects the same entries read by the Files sidebar, including implicit folders. */
export const readMountTree = (vfs: VirtualFilesystem): MountEntry[] => {
  const entries = new Map<string, MountEntry>(
    ['objects', 'patch'].map((path) => [path, { path, kind: 'directory' }])
  );

  for (const [vfsPath, entry] of vfs.getAllEntries()) {
    const prefix = vfsPath.startsWith('obj://')
      ? 'obj://'
      : vfsPath.startsWith('patch://')
        ? 'patch://'
        : null;
    if (!prefix) continue;

    const path = `${prefix === 'obj://' ? 'objects' : 'patch'}/${vfsPath.slice(prefix.length)}`;
    mountPathToVfs(path);

    const parts = path.split('/');
    for (let length = 1; length < parts.length; length++) {
      const parent = parts.slice(0, length).join('/');
      entries.set(parent, { path: parent, kind: 'directory' });
    }

    entries.set(
      path,
      isVFSFolder(entry)
        ? { path, kind: 'directory' }
        : { path, kind: 'file', content: vfs.readCodeFile(vfsPath) }
    );
  }

  return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
};

export const writeMountFile = async (
  vfs: VirtualFilesystem,
  path: string,
  content: string
): Promise<boolean> => {
  const vfsPath = mountPathToVfs(path);
  if (vfs.readCodeFile(vfsPath) === content) return false;

  vfs.writeCodeFile(vfsPath, content);
  if (vfsPath.startsWith('obj://')) await vfs.objectFiles.run(vfsPath);

  return true;
};
