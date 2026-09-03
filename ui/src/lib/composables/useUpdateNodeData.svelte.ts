import { useSvelteFlow, type Node } from '@xyflow/svelte';

type NodeData = object;
type NodeDataUpdate<TData extends NodeData> = (data: TData) => Partial<TData>;
type UpdateNode = (nodeId: string, update: (node: Node) => Partial<Node>) => void;

export function useUpdateNodeData() {
  const { updateNode } = useSvelteFlow();

  return <TData extends object>(nodeId: string, getUpdate: (data: TData) => Partial<TData>): void =>
    updateNodeDataFromCurrent(updateNode, nodeId, getUpdate);
}

export function updateNodeDataFromCurrent<TData extends NodeData>(
  updateNode: UpdateNode,
  nodeId: string,
  getUpdate: NodeDataUpdate<TData>
): void {
  updateNode(nodeId, (node) => {
    const data = node.data as unknown as TData;

    return { data: { ...node.data, ...getUpdate(data) } };
  });
}
