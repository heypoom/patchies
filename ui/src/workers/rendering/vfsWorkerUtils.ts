/**
 * VFS utilities for the render worker.
 *
 * Allows worker code to resolve VFS paths by requesting resolution from the main thread.
 * The main thread resolves the path using VirtualFilesystem, creates an object URL,
 * and sends back the URL string. Workers can use it directly (same origin).
 */

type PendingVfsRequest = {
	resolve: (url: string) => void;
	reject: (error: Error) => void;
};

/** Pending VFS URL resolution requests keyed by requestId */
const pendingVfsRequests = new Map<string, PendingVfsRequest>();

let requestIdCounter = 0;

/**
 * Handle VFS resolution response from main thread.
 * Call this from the render worker's message handler.
 */
export function handleVfsUrlResolved(data: {
	requestId: string;
	nodeId: string;
	url?: string;
	error?: string;
}): void {
	const pending = pendingVfsRequests.get(data.requestId);
	if (!pending) return;

	pendingVfsRequests.delete(data.requestId);

	if (data.error) {
		pending.reject(new Error(data.error));
		return;
	}

	if (data.url) {
		pending.resolve(data.url);
		return;
	}

	pending.reject(new Error('Invalid VFS resolution response'));
}

/**
 * Create a getVfsUrl function for use in user code.
 * The function requests VFS resolution from the main thread.
 */
export function createWorkerGetVfsUrl(nodeId: string): (path: string) => Promise<string> {
	return async function getVfsUrl(path: string): Promise<string> {
		const requestId = `vfs-${nodeId}-${++requestIdCounter}`;

		return new Promise((resolve, reject) => {
			pendingVfsRequests.set(requestId, { resolve, reject });

			self.postMessage({
				type: 'resolveVfsUrl',
				requestId,
				nodeId,
				path
			});
		});
	};
}
