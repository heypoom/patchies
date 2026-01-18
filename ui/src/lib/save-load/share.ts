import type { Node, Edge } from '@xyflow/svelte';
import { toast } from 'svelte-sonner';
import { appHostUrl, createShareablePatch } from '$lib/api/pb';
import { getSearchParam } from '$lib/utils/search-params';

/**
 * Creates a shareable link for the patch and copies it to clipboard.
 * Shows toast notifications for loading, success, and error states.
 */
export async function createAndCopyShareLink(nodes: Node[], edges: Edge[]): Promise<void> {
	toast.loading('Creating shareable link...');

	const id = await createShareablePatch(null, nodes, edges);
	if (id === null) {
		toast.error('Failed to create shareable link');
		return;
	}

	const room = getSearchParam('room');
	const url = room ? `${appHostUrl}/?id=${id}&room=${room}` : `${appHostUrl}/?id=${id}`;

	try {
		await navigator.clipboard.writeText(url);
		toast.success('Shareable link copied to clipboard');
	} catch {
		toast.error('Failed to copy link to clipboard');
	}
}
