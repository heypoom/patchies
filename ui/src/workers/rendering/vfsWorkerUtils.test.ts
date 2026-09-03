import { afterEach, describe, expect, it, vi } from 'vitest';

import { createWorkerVfs, handleVfsUrlResolved } from './vfsWorkerUtils';

describe('worker VFS API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads VFS file contents through the worker URL request', async () => {
    const postMessage = vi.fn();
    const fetchFile = vi.fn(async () => new Response('worker file'));

    vi.stubGlobal('self', { postMessage });
    vi.stubGlobal('fetch', fetchFile);

    const textPromise = createWorkerVfs('node-1').get('./file.txt').text();
    const request = postMessage.mock.calls[0][0];

    handleVfsUrlResolved({
      requestId: request.requestId,
      nodeId: 'node-1',
      url: 'blob:worker-file'
    });

    await expect(textPromise).resolves.toBe('worker file');
    expect(postMessage).toHaveBeenCalledWith({
      type: 'resolveVfsUrl',
      requestId: request.requestId,
      nodeId: 'node-1',
      path: './file.txt'
    });
    expect(fetchFile).toHaveBeenCalledWith('blob:worker-file');
  });
});
