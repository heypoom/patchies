import type { Edge, Node } from '@xyflow/svelte';
import { describe, expect, test, vi } from 'vitest';

vi.mock('$lib/history', () => ({
  AddNodeCommand: class {
    constructor(
      public node: Node,
      public canvasAccessors: unknown
    ) {}
  },
  BatchCommand: class {},
  DeleteEdgesCommand: class {},
  DeleteNodesCommand: class {}
}));

vi.mock('$lib/nodes/node-types', () => ({ nodeTypes: { 'gm~': {} } }));
vi.mock('$lib/presets/presets', () => ({ PRESETS: {} }));
vi.mock('$lib/objects/parse-object-param', () => ({ parseObjectParamFromString: vi.fn() }));
vi.mock('$lib/registry/AudioRegistry', () => ({
  AudioRegistry: { getInstance: () => ({ isDefined: () => false }) }
}));
vi.mock('$lib/registry/ObjectRegistry', () => ({
  ObjectRegistry: { getInstance: () => ({ isDefined: () => false }) }
}));
vi.mock('$lib/registry/ObjectShorthandRegistry', () => ({
  ObjectShorthandRegistry: { getInstance: () => ({ tryTransform: () => undefined }) }
}));

import { DEFAULT_GROUP_HEIGHT, DEFAULT_GROUP_WIDTH } from '$lib/nodes/defaultNodeDimensions';
import { NodeOperationsService } from './NodeOperationsService';

function createContext() {
  let nodes: Node[] = [];
  let edges: Edge[] = [];

  return {
    ctx: {
      get nodes() {
        return nodes;
      },
      set nodes(next: Node[]) {
        nodes = next;
      },
      get edges() {
        return edges;
      },
      set edges(next: Edge[]) {
        edges = next;
      },
      nextNodeId: (type: string) => `${type}-1`,
      historyManager: { execute: vi.fn() },
      canvasAccessors: {}
    },
    getNodes: () => nodes
  };
}

describe('NodeOperationsService', () => {
  test('creates gm~ as a dedicated visual node type', () => {
    const { ctx } = createContext();
    const service = new NodeOperationsService(
      ctx as unknown as ConstructorParameters<typeof NodeOperationsService>[0]
    );

    service.createNodeFromName('gm~', { x: 10, y: 20 });

    expect(ctx.historyManager.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        node: expect.objectContaining({
          id: 'gm~-1',
          type: 'gm~'
        })
      })
    );
    expect(ctx.historyManager.execute.mock.calls[0][0].node.data).toMatchObject({
      settings: expect.objectContaining({ source: 'soundfont' })
    });
  });

  test('creates new group nodes with explicit top-level dimensions', () => {
    const { ctx, getNodes } = createContext();
    const service = new NodeOperationsService(
      ctx as unknown as ConstructorParameters<typeof NodeOperationsService>[0]
    );

    const id = service.createNode('group', { x: 10, y: 20 }, undefined, { skipHistory: true });

    expect(getNodes().find((node) => node.id === id)).toMatchObject({
      type: 'group',
      width: DEFAULT_GROUP_WIDTH,
      height: DEFAULT_GROUP_HEIGHT,
      data: {}
    });
  });

  test('replaces nodes with group nodes that have explicit top-level dimensions', () => {
    const { ctx, getNodes } = createContext();
    ctx.nodes = [{ id: 'old-1', type: 'js', position: { x: 10, y: 20 }, data: {} }];
    const service = new NodeOperationsService(
      ctx as unknown as ConstructorParameters<typeof NodeOperationsService>[0]
    );

    service.replaceNode({
      type: 'nodeReplace',
      nodeId: 'old-1',
      newType: 'group',
      newData: {},
      handleMapping: {}
    });

    expect(getNodes()).toHaveLength(1);
    expect(getNodes()[0]).toMatchObject({
      id: 'group-1',
      type: 'group',
      width: DEFAULT_GROUP_WIDTH,
      height: DEFAULT_GROUP_HEIGHT,
      data: {}
    });
  });
});
