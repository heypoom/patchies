/**
 * VFS URL Helper
 *
 * Provides a `vfsUrl()` helper to resolve VFS paths (user://, obj://) to object URLs.
 * Usage: loadImage(await vfsUrl('user://images/photo.jpg'))
 */

import { createVfsApi, type VfsApi } from './user-api';

/** Object URLs created during the node lifecycle - must be revoked on destroy */
const objectUrls = new Map<string, Set<string>>();

function trackObjectUrl(nodeId: string, url: string): void {
  if (!objectUrls.has(nodeId)) {
    objectUrls.set(nodeId, new Set());
  }

  objectUrls.get(nodeId)!.add(url);
}

/** Revoke all object URLs for a node (call on node destroy) */
export function revokeObjectUrls(nodeId: string): void {
  const urls = objectUrls.get(nodeId);

  if (urls) {
    for (const url of urls) {
      URL.revokeObjectURL(url);
    }

    objectUrls.delete(nodeId);
  }
}

/**
 * Create the vfsUrl helper function for a specific node.
 *
 * Resolves a VFS path to an object URL that can be loaded.
 * If the path is not a VFS path, returns it unchanged.
 *
 * @example
 * // In preload or setup:
 * img = await loadImage(vfsUrl('user://images/photo.jpg'));
 *
 * // Or with regular URLs (passes through unchanged):
 * img = await loadImage(vfsUrl('https://example.com/image.png'));
 */
export function createVfs(nodeId: string): VfsApi {
  return createVfsApi((url) => trackObjectUrl(nodeId, url));
}
