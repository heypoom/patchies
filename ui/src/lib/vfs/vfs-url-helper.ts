/**
 * Per-node VFS API
 *
 * Creates the `vfs` object exposed to JavaScript nodes and tracks object URLs
 * created by `vfs.getUrl()` for cleanup when the node is destroyed.
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
 * Create the `vfs` object for a specific node.
 *
 * The object provides `getUrl()`, `list()`, and `search()`. URLs created by
 * `getUrl()` are tied to the node lifecycle and revoked on destroy.
 *
 * @example
 * const files = await vfs.list('.');
 * const url = await vfs.getUrl(files[0].path);
 */
export const createVfs = (nodeId: string): VfsApi =>
  createVfsApi((url) => trackObjectUrl(nodeId, url));
