export function getFileNameFromUrl(url: string): string {
	try {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;
		const filename = pathname.substring(pathname.lastIndexOf('/') + 1);

		// If we got a meaningful filename, use it
		if (filename && filename.includes('.')) {
			return decodeURIComponent(filename);
		}
	} catch {
		// URL parsing failed, continue to fallback
	}

	// Fallback: use extension-based naming
	const extension = getUrlExtension(url);

	return extension ? `audio.${extension}` : 'audio file';
}

function getUrlExtension(url: string): string {
	const match = url.match(/\.([a-z0-9]+)(\?.*)?$/i);

	return match ? match[1] : '';
}
