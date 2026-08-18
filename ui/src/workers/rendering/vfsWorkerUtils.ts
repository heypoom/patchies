/**
 * VFS utilities for the render worker.
 *
 * Allows worker code to resolve VFS paths by requesting resolution from the main thread.
 * The main thread resolves the path using VirtualFilesystem, creates an object URL,
 * and sends back the URL string. Workers can use it directly (same origin).
 */

export interface WorkerVfs {
  getUrl(path: string): Promise<string>;
  list(path?: string): Promise<string[]>;
  search(query: string, path?: string): Promise<string[]>;
}

type PendingVfsRequest = {
  resolve: (value: string | string[]) => void;
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

export function handleVfsPathsResolved(data: {
  requestId: string;
  paths?: string[];
  error?: string;
}): void {
  const pending = pendingVfsRequests.get(data.requestId);
  if (!pending) return;

  pendingVfsRequests.delete(data.requestId);

  if (data.error) {
    return pending.reject(new Error(data.error));
  }

  if (data.paths) {
    return pending.resolve(data.paths);
  }

  pending.reject(new Error('Invalid VFS listing response'));
}

/**
 * Create the VFS API for user code. Requests are resolved on the main thread.
 */
export function createWorkerVfs(nodeId: string): WorkerVfs {
  const request = <T extends string | string[]>(
    type: 'resolveVfsUrl' | 'listVfs' | 'searchVfs',
    payload: Record<string, string>
  ): Promise<T> => {
    const requestId = `vfs-${nodeId}-${++requestIdCounter}`;

    return new Promise((resolve, reject) => {
      pendingVfsRequests.set(requestId, {
        resolve: resolve as (value: string | string[]) => void,
        reject
      });

      self.postMessage({
        type,
        requestId,
        nodeId,
        ...payload
      });
    });
  };

  return {
    getUrl: (path) => request<string>('resolveVfsUrl', { path }),
    list: (path = '.') => request<string[]>('listVfs', { path }),
    search: (query, path = '.') => request<string[]>('searchVfs', { query, path })
  };
}
