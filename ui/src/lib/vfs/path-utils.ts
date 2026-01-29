// Path utilities for Virtual Filesystem

import { VFS_PREFIXES } from './types';

/**
 * Get file extension including the dot.
 * Example: 'photo.jpg' -> '.jpg'
 */
export function getExtension(filename: string): string {
	const lastDot = filename.lastIndexOf('.');
	if (lastDot === -1 || lastDot === 0) return '';
	return filename.slice(lastDot);
}

/**
 * Get filename without extension.
 * Example: 'photo.jpg' -> 'photo'
 */
export function getBasename(filename: string): string {
	const lastDot = filename.lastIndexOf('.');
	if (lastDot === -1 || lastDot === 0) return filename;
	return filename.slice(0, lastDot);
}

/**
 * Get the filename from a path.
 * Example: 'user://images/photo.jpg' -> 'photo.jpg'
 */
export function getFilename(path: string): string {
	const lastSlash = path.lastIndexOf('/');
	if (lastSlash === -1) return path;
	return path.slice(lastSlash + 1);
}

/**
 * Determine category folder based on MIME type.
 */
export function getCategoryFromMime(mimeType: string): 'images' | 'videos' | 'audio' | 'files' {
	if (mimeType.startsWith('image/')) return 'images';
	if (mimeType.startsWith('video/')) return 'videos';
	if (mimeType.startsWith('audio/')) return 'audio';
	return 'files';
}

/**
 * Determine category folder based on file extension.
 */
export function getCategoryFromExtension(
	filename: string
): 'images' | 'videos' | 'audio' | 'files' {
	const ext = getExtension(filename).toLowerCase();

	const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
	const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
	const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.aiff'];

	if (imageExts.includes(ext)) return 'images';
	if (videoExts.includes(ext)) return 'videos';
	if (audioExts.includes(ext)) return 'audio';
	return 'files';
}

/**
 * Generate a unique user:// path for a file, handling collisions.
 *
 * @param filename - Original filename (e.g., 'photo.jpg')
 * @param _mimeType - Unused, kept for API compatibility
 * @param existingPaths - Set of paths already in use
 * @param targetFolder - Optional target folder path (e.g., 'user://images/')
 * @returns Generated path like 'user://photo.jpg' or 'user://images/photo.jpg'
 */
export function generateUserPath(
	filename: string,
	_mimeType: string | undefined,
	existingPaths: Set<string>,
	targetFolder?: string
): string {
	const ext = getExtension(filename);
	const base = getBasename(filename);

	// Determine the prefix - either the target folder or default user://
	let prefix = VFS_PREFIXES.USER;
	if (targetFolder) {
		// Ensure the folder ends with /
		prefix = targetFolder.endsWith('/') ? targetFolder : `${targetFolder}/`;
	}

	let path = `${prefix}${filename}`;
	let counter = 1;

	while (existingPaths.has(path)) {
		path = `${prefix}${base}-${counter}${ext}`;
		counter++;
	}

	return path;
}

/**
 * Generate an object-scoped path.
 *
 * @param nodeId - Node ID (e.g., 'csound~-24')
 * @param filename - Filename within the node's filesystem
 * @returns Path like 'obj://csound~-24/file.csd'
 */
export function generateObjectPath(nodeId: string, filename: string): string {
	return `${VFS_PREFIXES.OBJECT}${nodeId}/${filename}`;
}

/**
 * Extract filename from a URL.
 * Example: 'https://example.com/path/to/image.png?query=1' -> 'image.png'
 */
export function getFilenameFromUrl(url: string): string {
	try {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;
		const filename = pathname.substring(pathname.lastIndexOf('/') + 1);

		if (filename && filename.includes('.')) {
			return decodeURIComponent(filename);
		}
	} catch {
		// URL parsing failed
	}

	// Fallback: try to extract something reasonable
	const lastSlash = url.lastIndexOf('/');
	if (lastSlash !== -1) {
		const candidate = url
			.slice(lastSlash + 1)
			.split('?')[0]
			.split('#')[0];
		if (candidate && candidate.includes('.')) {
			return decodeURIComponent(candidate);
		}
	}

	return 'file';
}

/**
 * Guess MIME type from filename extension.
 */
export function guessMimeType(filename: string): string | undefined {
	const ext = getExtension(filename).toLowerCase();

	const mimeMap: Record<string, string> = {
		// Images
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.gif': 'image/gif',
		'.webp': 'image/webp',
		'.svg': 'image/svg+xml',
		'.bmp': 'image/bmp',
		'.ico': 'image/x-icon',
		// Videos
		'.mp4': 'video/mp4',
		'.webm': 'video/webm',
		'.mov': 'video/quicktime',
		'.avi': 'video/x-msvideo',
		'.mkv': 'video/x-matroska',
		'.m4v': 'video/x-m4v',
		// Audio
		'.mp3': 'audio/mpeg',
		'.wav': 'audio/wav',
		'.ogg': 'audio/ogg',
		'.flac': 'audio/flac',
		'.aac': 'audio/aac',
		'.m4a': 'audio/mp4',
		'.aiff': 'audio/aiff',
		// Code
		'.js': 'application/javascript'
	};

	return mimeMap[ext];
}
