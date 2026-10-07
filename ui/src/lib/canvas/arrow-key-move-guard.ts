import type { XYPosition } from '@xyflow/svelte';
import type { NodeInteractionUpdateEvent } from '$lib/eventbus/events';

type MovableNode = { draggable?: boolean };

type MovementStore<T extends MovableNode> = {
  nodeLookup: Map<string, T>;
  moveSelectedNodes: (direction: XYPosition, factor: number) => void;
};

/** Filters both XYFlow node and selection-overlay keyboard movement. */
export function installArrowKeyMoveGuard<T extends MovableNode>(store: MovementStore<T>) {
  const disabledNodes = new Set<string>();
  const originalMove = store.moveSelectedNodes;

  function handleInteractionUpdate(event: NodeInteractionUpdateEvent) {
    if (event.mode !== 'arrowKeyMove' && event.mode !== 'interact') return;

    if (event.enabled) {
      disabledNodes.delete(event.nodeId);
    } else {
      disabledNodes.add(event.nodeId);
    }
  }

  function moveSelectedNodes(direction: XYPosition, factor: number) {
    const restore: { node: T; draggable: boolean | undefined }[] = [];

    // XYFlow uses the internal draggable flag to filter keyboard movement.
    // Restore it synchronously so pointer dragging and saved data are unaffected.
    for (const id of disabledNodes) {
      const node = store.nodeLookup.get(id);
      if (!node) continue;

      restore.push({ node, draggable: node.draggable });
      node.draggable = false;
    }

    try {
      originalMove(direction, factor);
    } finally {
      for (const { node, draggable } of restore) {
        if (draggable === undefined) {
          delete node.draggable;
        } else {
          node.draggable = draggable;
        }
      }
    }
  }

  store.moveSelectedNodes = moveSelectedNodes;

  return {
    handleInteractionUpdate,
    destroy() {
      store.moveSelectedNodes = originalMove;
      disabledNodes.clear();
    }
  };
}
