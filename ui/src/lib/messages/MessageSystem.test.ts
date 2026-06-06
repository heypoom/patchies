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
