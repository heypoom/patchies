import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RenderNode } from '$lib/rendering/types';

vi.mock('$lib/glsl-include/worker-resolver', () => ({
  createWorkerResolver: () => ({
    resolveNpm: vi.fn(async () => ''),
    resolveUrl: vi.fn(async () => ''),
    resolveVfs: vi.fn(async (path: string) => {
      throw new Error(`VFS: Path not found: ${path}`);
    })
  })
}));

import { ShaderRendererFactory } from './ShaderRendererFactory';

describe('ShaderRendererFactory GLSL includes', () => {
  const postMessage = vi.fn();

  beforeEach(() => {
    postMessage.mockClear();
    vi.stubGlobal('self', { postMessage });
  });

  it('reports a missing include on the originating source line', async () => {
    const owner = {
      uniformDataByNode: new Map()
    };
    const factory = new ShaderRendererFactory(owner as never);
    const node = {
      id: 'glsl-1',
      inputs: [],
      outputs: [],
      inletMap: new Map(),
      backEdgeInlets: new Set(),
      type: 'glsl',
      data: {
        code: 'float before = 1.0;\n#include "patch://non-existent-file"',
        glUniformDefs: []
      }
    } as Extract<RenderNode, { type: 'glsl' }>;

    await expect(factory.create(node, {} as never)).resolves.toBeNull();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'shaderError',
        nodeId: 'glsl-1',
        error: 'Include error on line 2: VFS: Path not found: patch://non-existent-file.glsl',
        lineErrors: {
          2: ['VFS: Path not found: patch://non-existent-file.glsl']
        }
      })
    );
  });
});
