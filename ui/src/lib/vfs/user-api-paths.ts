import { isVFSPath, VFS_PREFIXES } from './types';

/** Normalize a user-code path to a VFS path. Relative paths live in `user://`. */
export function normalizeUserVfsPath(path: string): string {
  if (isExternalUrl(path)) {
    throw new Error(
      `Invalid VFS path: "${path}". Only user://, patch://, and obj:// protocols are supported.`
    );
  }

  if (isVFSPath(path)) {
    return path.endsWith('/') && !path.endsWith('://') ? path.slice(0, -1) : path;
  }

  if (path === '.' || path === './') return VFS_PREFIXES.USER;
  if (path.startsWith('./')) return `${VFS_PREFIXES.USER}${path.slice(2).replace(/\/$/, '')}`;

  return `${VFS_PREFIXES.USER}${path.replace(/\/$/, '')}`;
}

/** True when a path is an external URL that should not be looked up in the VFS. */
export const isExternalUrl = (path: string): boolean =>
  !isVFSPath(path) && (path.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(path));
