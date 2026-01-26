/**
 * P5.js VFS Integration
 *
 * Provides a simple `vfsUrl()` helper to resolve VFS paths (user://, obj://) to object URLs.
 * Usage in P5.js: loadImage(await vfsUrl('user://images/photo.jpg'))
 */

import { VirtualFilesystem, isVFSPath } from '$lib/vfs';

/** Object URLs created during the sketch lifecycle - must be revoked on destroy */
const objectUrls = new Map<string, Set<string>>();

function trackObjectUrl(nodeId: string, url: string): void {
	if (!objectUrls.has(nodeId)) {
		objectUrls.set(nodeId, new Set());
	}

	objectUrls.get(nodeId)!.add(url);
}

/** Revoke all object URLs for a node (call on sketch destroy) */
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
 * Resolves a VFS path to an object URL that P5.js can load.
 * If the path is not a VFS path, returns it unchanged.
 *
 * @example
 * // In P5.js preload():
 * img = await loadImage(vfsUrl('user://images/photo.jpg'));
 *
 * // Or with regular URLs (passes through unchanged):
 * img = await loadImage(vfsUrl('https://example.com/image.png'));
 */
export function createGetVfsUrl(nodeId: string): (path: string) => Promise<string> {
	return async function vfsUrl(path: string): Promise<string> {
		// VFS is only accessible on the main thread for now
		if (typeof window === 'undefined') return path;

		if (!isVFSPath(path)) {
			return path;
		}

		const vfs = VirtualFilesystem.getInstance();
		const blob = await vfs.resolve(path);
		const url = URL.createObjectURL(blob);
		trackObjectUrl(nodeId, url);
		return url;
	};
}
