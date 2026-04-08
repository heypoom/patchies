/**
 * VFS resolver for GLSL #include in web workers.
 *
 * Resolves "user://..." paths by posting a message to the main thread,
 * which reads the VFS file and sends back the text content.
 *
 * Uses the same request/response pattern as vfsWorkerUtils.ts but returns
 * text content instead of object URLs.
 */

type PendingRequest = {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  timerId: ReturnType<typeof setTimeout>;
};

const pendingRequests = new Map<string, PendingRequest>();
let requestIdCounter = 0;

/** Timeout for VFS text resolution requests (ms). */
const VFS_RESOLVE_TIMEOUT_MS = 10_000;

/**
 * Handle VFS text resolution response from the main thread.
 * Call this from the render worker's message handler.
 */
export function handleVfsTextResolved(data: {
  requestId: string;
  text?: string;
  error?: string;
}): void {
  const pending = pendingRequests.get(data.requestId);
  if (!pending) return;

  clearTimeout(pending.timerId);
  pendingRequests.delete(data.requestId);

  if (data.error) {
    pending.reject(new Error(data.error));
    return;
  }

  if (data.text !== undefined) {
    pending.resolve(data.text);
    return;
  }

  pending.reject(new Error('Invalid VFS text resolution response'));
}

/**
 * Resolve a VFS path to its GLSL text content from a worker.
 */
export function resolveVfsText(nodeId: string, vfsPath: string): Promise<string> {
  const requestId = `glsl-vfs-${nodeId}-${++requestIdCounter}`;

  return new Promise((resolve, reject) => {
    const timerId = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(
        new Error(`VFS text resolution timed out for "${vfsPath}" (${VFS_RESOLVE_TIMEOUT_MS}ms)`)
      );
    }, VFS_RESOLVE_TIMEOUT_MS);

    pendingRequests.set(requestId, { resolve, reject, timerId });

    self.postMessage({
      type: 'resolveVfsText',
      requestId,
      nodeId,
      path: vfsPath
    });
  });
}
