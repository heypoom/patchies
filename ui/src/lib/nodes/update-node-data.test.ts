import type { Node } from '@xyflow/svelte';
import { describe, expect, it } from 'vitest';

import { MessageSystem } from '$lib/messages/MessageSystem';

import { updateNodeDataFromCurrent } from './update-node-data';

type TestData = {
  params: unknown[];
  revision: number;
};

describe('updateNodeDataFromCurrent', () => {
  it('composes sequential collection updates against the current node data', () => {
    let node: Node<TestData> = {
      id: 'target',
      type: 'object',
      position: { x: 0, y: 0 },
      data: {
        params: [440, 'sine', 0],
        revision: 0
      }
    };

    const updateNode = (_nodeId: string, update: (node: Node) => Partial<Node>) => {
      const nodeUpdate = update(node);

      node = {
        ...node,
        ...nodeUpdate,
        data: (nodeUpdate.data ?? node.data) as TestData
      };
    };

    const updateParam = (index: number, value: unknown) =>
      updateNodeDataFromCurrent<TestData>(updateNode, node.id, (data) => {
        const params = [...data.params];
        params[index] = value;

        return { params, revision: data.revision + 1 };
      });

    updateParam(0, 100);
    updateParam(2, 100);

    expect(node.data.params).toEqual([100, 'sine', 100]);
    expect(node.data.revision).toBe(2);
  });

  it('preserves every inlet update when one message fans out to the same node', () => {
    const suffix = crypto.randomUUID();
    const sourceNodeId = `node-data-source-${suffix}`;
    const targetNodeId = `node-data-target-${suffix}`;
    const messageSystem = MessageSystem.getInstance();

    let node: Node<TestData> = {
      id: targetNodeId,
      type: 'object',
      position: { x: 0, y: 0 },
      data: {
        params: [440, 'sine', 0],
        revision: 0
      }
    };

    const updateNode = (_nodeId: string, update: (node: Node) => Partial<Node>) => {
      const nodeUpdate = update(node);

      node = {
        ...node,
        ...nodeUpdate,
        data: (nodeUpdate.data ?? node.data) as TestData
      };
    };

    messageSystem.updateEdges([
      {
        id: `frequency-edge-${suffix}`,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle: 'message-out',
        targetHandle: 'message-in-0'
      },
      {
        id: `detune-edge-${suffix}`,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle: 'message-out',
        targetHandle: 'message-in-2'
      }
    ]);

    messageSystem.registerNode(targetNodeId).addCallback((message, meta) => {
      const inlet = meta.inlet;
      if (inlet === undefined) return;

      updateNodeDataFromCurrent<TestData>(updateNode, targetNodeId, (data) => {
        const params = [...data.params];
        params[inlet] = message;

        return { params };
      });
    });

    messageSystem.sendMessage(sourceNodeId, 100);

    const params = node.data.params;
    messageSystem.unregisterNode(targetNodeId);
    messageSystem.updateEdges([]);

    expect(params).toEqual([100, 'sine', 100]);
  });
});
