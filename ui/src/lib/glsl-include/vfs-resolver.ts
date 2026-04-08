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
};

const pendingRequests = new Map<string, PendingRequest>();
let requestIdCounter = 0;

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
    pendingRequests.set(requestId, { resolve, reject });

    self.postMessage({
      type: 'resolveVfsText',
      requestId,
      nodeId,
      path: vfsPath
    });
  });
}
