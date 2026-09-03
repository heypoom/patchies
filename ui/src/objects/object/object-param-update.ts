import type { Node } from '@xyflow/svelte';

import type { ObjectNodeData } from './types';

type ObjectNodeDataUpdate = (node: Node) => Partial<ObjectNodeData>;
type UpdateObjectNodeData = (nodeId: string, update: ObjectNodeDataUpdate) => void;

const createObjectParamUpdate =
  (updates: ReadonlyMap<number, unknown>) =>
  (node: Node): Partial<ObjectNodeData> => {
    const data = node.data as ObjectNodeData;
    const params = [...data.params];

    for (const [index, value] of updates) {
      params[index] = value;
    }

    return { params };
  };

export function createObjectParamUpdater(
  getNodeId: () => string,
  updateNodeData: UpdateObjectNodeData
) {
  const pendingUpdates = new Map<number, unknown>();
  let isFlushScheduled = false;

  return (index: number, value: unknown): void => {
    pendingUpdates.set(index, value);
    if (isFlushScheduled) return;

    isFlushScheduled = true;

    queueMicrotask(() => {
      const updates = new Map(pendingUpdates);
      pendingUpdates.clear();
      isFlushScheduled = false;

      updateNodeData(getNodeId(), createObjectParamUpdate(updates));
    });
  };
}
