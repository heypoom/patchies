import { useSvelteFlow } from '@xyflow/svelte';

import { updateNodeDataFromCurrent } from '$lib/nodes/update-node-data';

export function useUpdateNodeData() {
  const { updateNode } = useSvelteFlow();

  return <TData extends object>(nodeId: string, getUpdate: (data: TData) => Partial<TData>): void =>
    updateNodeDataFromCurrent(updateNode, nodeId, getUpdate);
}
