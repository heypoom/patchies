import { describe, expect, it } from 'vitest';

import { MessageSystem } from './MessageSystem';

describe('MessageSystem patchbay edges', () => {
  it('routes messages across registered patchbay edges', () => {
    const suffix = crypto.randomUUID();
    const sourceNodeId = `patchbay-source-${suffix}`;
    const targetNodeId = `patchbay-target-${suffix}`;
    const routeId = `patchbay-route-${suffix}`;
    const received: unknown[] = [];
    const messageSystem = MessageSystem.getInstance();

    messageSystem.updateEdges([]);
    messageSystem.registerNode(targetNodeId).addCallback((data) => {
      received.push(data);
    });
    messageSystem.registerPatchbayEdge(routeId, {
      id: routeId,
      source: sourceNodeId,
      target: targetNodeId,
      sourceHandle: 'message-out',
      targetHandle: 'message-in'
    });

    messageSystem.sendMessage(sourceNodeId, { type: 'bang' });

    expect(received).toEqual([{ type: 'bang' }]);

    messageSystem.unregisterPatchbayEdge(routeId);
    messageSystem.unregisterNode(targetNodeId);
  });
});

describe('MessageSystem view remount routing', () => {
  it('keeps graph routes restorable when a node unregisters and registers without edge changes', () => {
    const suffix = crypto.randomUUID();
    const sourceNodeId = `remount-source-${suffix}`;
    const targetNodeId = `remount-target-${suffix}`;
    const received: unknown[] = [];
    const messageSystem = MessageSystem.getInstance();

    messageSystem.updateEdges([
      {
        id: `remount-edge-${suffix}`,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle: 'message-out',
        targetHandle: 'message-in'
      }
    ]);

    messageSystem.registerNode(sourceNodeId);
    messageSystem.registerNode(targetNodeId).addCallback((data) => {
      received.push(data);
    });

    messageSystem.sendMessage(sourceNodeId, 'before remount');

    messageSystem.unregisterNode(sourceNodeId);
    messageSystem.registerNode(sourceNodeId);
    messageSystem.sendMessage(sourceNodeId, 'after source remount');

    messageSystem.unregisterNode(targetNodeId);
    messageSystem.registerNode(targetNodeId).addCallback((data) => {
      received.push(data);
    });
    messageSystem.sendMessage(sourceNodeId, 'after target remount');

    expect(received).toEqual(['before remount', 'after source remount', 'after target remount']);

    messageSystem.unregisterNode(sourceNodeId);
    messageSystem.unregisterNode(targetNodeId);
    messageSystem.updateEdges([]);
  });
});
