import type { Node } from '@xyflow/svelte';

type NodeData = object;
type NodeDataUpdate<TData extends NodeData> = (data: TData) => Partial<TData>;
type UpdateNode = (nodeId: string, update: (node: Node) => Partial<Node>) => void;

/**
 * Applies a read-modify-write data update against XYFlow's current nodes array.
 *
 * `updateNodeData` functional updates can read from a stale node lookup when
 * several updates target one node in the same turn. `updateNode` evaluates its
 * callback while reducing the current nodes array, so sequential updates compose.
 */
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
