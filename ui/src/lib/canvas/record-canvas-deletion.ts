import type { Edge, Node } from '@xyflow/svelte';
import { BatchCommand, DeleteEdgesCommand, DeleteNodesCommand, type Command } from '$lib/history';
import type { CanvasContext } from '$lib/services/CanvasContext';

/** Records XYFlow deletions before it removes the elements. */
export function recordCanvasDeletion(
  context: CanvasContext,
  nodes: Node[],
  edges: Edge[]
): boolean {
  const commands: Command[] = [];
  const accessors = context.canvasAccessors;

  if (nodes.length > 0) {
    commands.push(new DeleteNodesCommand(nodes, accessors));
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const standaloneEdges = edges.filter(
    (edge) => !nodeIds.has(edge.source) && !nodeIds.has(edge.target)
  );

  if (standaloneEdges.length > 0) {
    commands.push(new DeleteEdgesCommand(standaloneEdges, accessors));
  }

  if (commands.length === 1) {
    context.historyManager.record(commands[0]);
  } else if (commands.length > 1) {
    context.historyManager.record(new BatchCommand(commands, 'Delete selection'));
  }

  return true;
}
