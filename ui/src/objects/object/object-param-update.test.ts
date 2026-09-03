import type { Node } from '@xyflow/svelte';
import { describe, expect, it } from 'vitest';

import { MessageSystem } from '$lib/messages/MessageSystem';

import { createObjectParamUpdater } from './object-param-update';
import type { ObjectNodeData } from './types';

describe('createObjectParamUpdate', () => {
  it('preserves every inlet update when one message fans out to the same node', async () => {
    const suffix = crypto.randomUUID();
    const sourceNodeId = `object-param-source-${suffix}`;
    const targetNodeId = `object-param-target-${suffix}`;
    const messageSystem = MessageSystem.getInstance();

    let node: Node<ObjectNodeData> = {
      id: targetNodeId,
      type: 'object',
      position: { x: 0, y: 0 },
      data: {
        name: 'osc~',
        expr: 'osc~ 440 sine 0',
        params: [440, 'sine', 0]
      }
    };

    let editorUpdateCount = 0;

    const updateNodeData = (_nodeId: string, update: (node: Node) => Partial<ObjectNodeData>) => {
      editorUpdateCount += 1;

      node = {
        ...node,
        data: {
          ...node.data,
          ...update(node)
        }
      };
    };

    const updateParam = createObjectParamUpdater(() => targetNodeId, updateNodeData);

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
      if (meta.inlet === undefined) return;

      updateParam(meta.inlet, message);
    });

    messageSystem.sendMessage(sourceNodeId, 100);
    expect(editorUpdateCount).toBe(0);

    await Promise.resolve();

    const params = node.data.params;
    messageSystem.unregisterNode(targetNodeId);
    messageSystem.updateEdges([]);

    expect(params).toEqual([100, 'sine', 100]);
    expect(editorUpdateCount).toBe(1);
  });
});
