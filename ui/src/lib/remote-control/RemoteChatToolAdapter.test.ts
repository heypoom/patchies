import { describe, expect, it, vi } from 'vitest';
import type { AiPromptCallbacks } from '$lib/ai/ai-prompt-controller.svelte';
import type { ChatGraphSummary, ChatNode, ChatViewportSummary } from '$lib/ai/chat/resolver';
import { RemoteChatToolAdapter } from './RemoteChatToolAdapter';

const vfsHandlers = vi.hoisted(() => ({
  listVfsFiles: vi.fn(),
  readVfsText: vi.fn(),
  searchVfsFiles: vi.fn(),
  statVfsFile: vi.fn()
}));

vi.mock('$lib/ai/chat/vfs-tool-handlers', () => vfsHandlers);

const graph: ChatGraphSummary = {
  nodes: [{ id: 'osc-1', type: 'osc~', name: 'oscillator', position: { x: 10, y: 20 } }],
  edges: [
    {
      id: 'edge-1',
      source: 'osc-1',
      target: 'out-1',
      sourceHandle: 'out',
      targetHandle: 'in'
    }
  ]
};

const node: ChatNode = { id: 'osc-1', type: 'osc~', data: { frequency: 220 } };

function createAdapter(callbacks: Partial<AiPromptCallbacks> = {}) {
  return new RemoteChatToolAdapter({
    callbacks: {
      onInsertObject: vi.fn(),
      onInsertMultipleObjects: vi.fn(),
      onEditObject: vi.fn(),
      onReplaceObject: vi.fn(),
      onConnectEdges: vi.fn(),
      onDisconnectEdges: vi.fn(),
      onDeleteObjects: vi.fn(),
      onMoveObjects: vi.fn(),
      ...callbacks
    },
    getNodeById: (nodeId) => (nodeId === node.id ? node : undefined),
    getGraphSummary: () => graph,
    getViewportSummary: () =>
      ({
        viewport: { x: 0, y: 0, zoom: 1 },
        bounds: { left: 0, top: 0, right: 100, bottom: 100 },
        center: { x: 50, y: 50 }
      }) as ChatViewportSummary
  });
}

describe('RemoteChatToolAdapter', () => {
  it('exposes the chat graph and object data tools', async () => {
    const adapter = createAdapter();

    await expect(adapter.handle({ tool: 'get_graph_nodes', args: {} })).resolves.toEqual({
      ok: true,
      result: graph
    });
    await expect(
      adapter.handle({ tool: 'get_object_data', args: { objectId: 'osc-1' } })
    ).resolves.toEqual({ ok: true, result: { ...node, connectedEdges: [graph.edges[0]] } });
  });

  it('applies validated direct chat actions through canvas callbacks', async () => {
    const onDeleteObjects = vi.fn();
    const adapter = createAdapter({ onDeleteObjects });

    const response = await adapter.handle({ tool: 'delete_objects', args: { nodeIds: ['osc-1'] } });

    expect(response).toMatchObject({ ok: true, result: { state: 'applied' } });
    expect(onDeleteObjects).toHaveBeenCalledWith(['osc-1']);
  });

  it('returns validation failures without calling a canvas callback', async () => {
    const onDeleteObjects = vi.fn();
    const adapter = createAdapter({ onDeleteObjects });

    await expect(
      adapter.handle({ tool: 'delete_objects', args: { nodeIds: ['missing'] } })
    ).resolves.toEqual({
      ok: false,
      error: 'Node "missing" not found'
    });
    expect(onDeleteObjects).not.toHaveBeenCalled();
  });

  it('exposes object instructions, documentation search, and VFS lookups', async () => {
    const adapter = createAdapter();
    vfsHandlers.readVfsText.mockResolvedValue({ path: './notes.md', content: 'hello' });

    await expect(
      adapter.handle({ tool: 'get_object_instructions', args: { type: 'glsl' } })
    ).resolves.toMatchObject({ ok: true, result: { type: 'glsl' } });
    await expect(
      adapter.handle({ tool: 'search_docs', args: { query: 'glsl' } })
    ).resolves.toMatchObject({
      ok: true,
      result: { total: expect.any(Number) }
    });
    await expect(
      adapter.handle({ tool: 'read_vfs_text', args: { path: './notes.md' } })
    ).resolves.toEqual({ ok: true, result: { path: './notes.md', content: 'hello' } });

    expect(vfsHandlers.readVfsText).toHaveBeenCalledWith({ path: './notes.md' });
  });
});
