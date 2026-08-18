import { isVFSPath, VFS_PREFIXES } from './types';

/** Normalize a user-code path to a VFS path. Relative paths live in `user://`. */
export function normalizeUserVfsPath(path: string): string {
  if (isVFSPath(path)) {
    return path.endsWith('/') && !path.endsWith('://') ? path.slice(0, -1) : path;
  }

  if (path === '.' || path === './') return VFS_PREFIXES.USER;
  if (path.startsWith('./')) return `${VFS_PREFIXES.USER}${path.slice(2).replace(/\/$/, '')}`;

  return `${VFS_PREFIXES.USER}${path.replace(/\/$/, '')}`;
}

/** True when a path is an external URL that should not be looked up in the VFS. */
export function isExternalUrl(path: string): boolean {
  if (path.startsWith('//')) return true;

  try {
    return !isVFSPath(path) && new URL(path).protocol !== '';
  } catch {
    return false;
  }
}
