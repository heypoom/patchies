import { VirtualFilesystem } from './VirtualFilesystem';
import { createVfsFileReader, type VfsFileReader } from './file-reader';
import type { VFSListEntry } from './types';
import { normalizeUserVfsPath } from './user-api-paths';

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
      const vfsPath = normalizeUserVfsPath(path);

      const vfs = VirtualFilesystem.getInstance();
      const blob = await vfs.resolve(vfsPath);

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
