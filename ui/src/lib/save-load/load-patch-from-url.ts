import type { PatchSaveFormat } from './serialize-patch';

export type LoadFromUrlResult =
	| { success: true; data: PatchSaveFormat }
	| { success: false; error: string };

export async function loadPatchFromUrl(url: string): Promise<LoadFromUrlResult> {
	try {
		// Validate URL format
		const urlObj = new URL(url);

		if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
			return {
				success: false,
				error: 'Only HTTP and HTTPS URLs are supported'
			};
		}

		const response = await fetch(url, {
			method: 'GET',
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			return {
				success: false,
				error: `Failed to fetch patch: ${response.status} ${response.statusText}`
			};
		}

		const patchData: PatchSaveFormat = await response.json();

		if (!patchData.nodes || !Array.isArray(patchData.nodes)) {
			return {
				success: false,
				error: 'Invalid patch format: missing or invalid nodes array'
			};
		}

		if (!patchData.edges || !Array.isArray(patchData.edges)) {
			return {
				success: false,
				error: 'Invalid patch format: missing or invalid edges array'
			};
		}

		return { success: true, data: patchData };
	} catch (error) {
		if (error instanceof TypeError && error.message.includes('Invalid URL')) {
			return {
				success: false,
				error: 'Invalid URL format'
			};
		}

		if (error instanceof Error && error.name === 'AbortError') {
			return {
				success: false,
				error: 'Request timed out'
			};
		}

		if (error instanceof SyntaxError) {
			return {
				success: false,
				error: 'Invalid JSON format in patch file'
			};
		}

		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error occurred'
		};
	}
}
