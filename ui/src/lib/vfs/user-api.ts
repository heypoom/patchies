import { VirtualFilesystem } from './VirtualFilesystem';
import { isExternalUrl, normalizeUserVfsPath } from './user-api-paths';

export interface VfsApi {
  getUrl(path: string): Promise<string>;
  list(path?: string): Promise<string[]>;
  search(query: string, path?: string): Promise<string[]>;
}

/** Create the VFS API exposed to code that runs on the main thread. */
export function createVfsApi(trackObjectUrl: (url: string) => void): VfsApi {
  return {
    async getUrl(path) {
      if (typeof window === 'undefined' || isExternalUrl(path)) return path;

      const blob = await VirtualFilesystem.getInstance().resolve(normalizeUserVfsPath(path));
      const url = URL.createObjectURL(blob);
      trackObjectUrl(url);
      return url;
    },
    async list(path = '.') {
      return VirtualFilesystem.getInstance().listChildren(normalizeUserVfsPath(path));
    },
    async search(query, path = '.') {
      return VirtualFilesystem.getInstance().search(query, normalizeUserVfsPath(path));
    }
  };
}
