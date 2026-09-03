import { VirtualFilesystem } from './VirtualFilesystem';
import { createVfsFileReader, type VfsFileReader } from './file-reader';
import type { VFSListEntry } from './types';
import { isExternalUrl, normalizeUserVfsPath } from './user-api-paths';

export interface VfsApi {
  get(path: string): VfsFileReader;
  getUrl(path: string): Promise<string>;
  list(path?: string): Promise<VFSListEntry[]>;
  search(query: string, path?: string): Promise<VFSListEntry[]>;
}

/** Create the VFS API exposed to code that runs on the main thread. */
export function createVfsApi(trackObjectUrl: (url: string) => void): VfsApi {
  const api: VfsApi = {
    get: (path) => createVfsFileReader(path, api.getUrl),
    async getUrl(path) {
      if (typeof window === 'undefined' || isExternalUrl(path)) return path;

      const vfs = VirtualFilesystem.getInstance();
      const blob = await vfs.resolve(normalizeUserVfsPath(path));

      const url = URL.createObjectURL(blob);
      trackObjectUrl(url);

      return url;
    },
    async list(path = '.') {
      const vfs = VirtualFilesystem.getInstance();

      return vfs.listChildren(normalizeUserVfsPath(path));
    },
    async search(query, path = '.') {
      const vfs = VirtualFilesystem.getInstance();

      return vfs.search(query, normalizeUserVfsPath(path));
    }
  };

  return api;
}
