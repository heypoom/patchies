// Virtual Filesystem - main exports

export { VirtualFilesystem } from './VirtualFilesystem';
export {
  MAX_EMBEDDED_FILE_BYTES,
  MAX_EMBEDDED_PATCH_BYTES,
  PATCH_TEXT_FILE_ACCEPT,
  getPatchImportError
} from './VirtualFilesystem';

// Composables
export { useVfsMedia, type UseVfsMediaOptions, type UseVfsMediaReturn } from './useVfsMedia.svelte';

export {
  type VFSEntry,
  type EmbeddedVFSEntry,
  type VFSListEntry,
  type VFSListPage,
  type VFSSearchPage,
  type VFSTree,
  type VFSTreeNode,
  type VFSProvider,
  type VFSProviderType,
  isVFSEntry,
  isEmbeddedVFSEntry,
  isVFSPath,
  isVFSFolder,
  isLocalFolder,
  parseVFSPath,
  VFS_PREFIXES,
  VFS_FOLDERS,
  VFS_DEFAULT_EXPANDED
} from './types';
export {
  generateUserPath,
  generateObjectPath,
  getExtension,
  getBasename,
  getFilename,
  getFilenameFromUrl,
  getCategoryFromMime,
  getCategoryFromExtension,
  guessMimeType
} from './path-utils';
export { UrlProvider } from './providers/UrlProvider';
export { LocalFilesystemProvider } from './providers/LocalFilesystemProvider';
export { EmbeddedProvider } from './providers/EmbeddedProvider';
export { createVfs, revokeObjectUrls } from './vfs-url-helper';
export type { VfsApi } from './user-api';

// Persistence utilities (for advanced use)
export {
  storeHandle,
  getHandle,
  removeHandle,
  getAllHandles,
  clearHandles,
  hasPermission,
  requestHandlePermission,
  // File data fallback (for Firefox/Safari)
  storeFileData,
  getFileData,
  removeFileData,
  clearFileData,
  hasFileData
} from './persistence';

import { VirtualFilesystem } from './VirtualFilesystem';
import { UrlProvider } from './providers/UrlProvider';
import { LocalFilesystemProvider } from './providers/LocalFilesystemProvider';
import { EmbeddedProvider } from './providers/EmbeddedProvider';

/**
 * Initialize the VFS with default providers.
 * Call this once at app startup.
 */
export function initializeVFS(): VirtualFilesystem {
  const vfs = VirtualFilesystem.getInstance();

  // Register default providers
  vfs.registerProvider(new UrlProvider());
  vfs.registerProvider(new LocalFilesystemProvider());
  vfs.registerProvider(new EmbeddedProvider());

  return vfs;
}

/**
 * Get the LocalFilesystemProvider instance from VFS.
 * Useful for accessing provider-specific methods like storeFileWithHandle.
 */
export function getLocalProvider(): LocalFilesystemProvider | undefined {
  const vfs = VirtualFilesystem.getInstance();

  return vfs.getProvider('local') as LocalFilesystemProvider | undefined;
}
