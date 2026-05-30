import type { Node } from '@xyflow/svelte';
import type { CodeEditorTarget } from '../../stores/code-editor-layout.store';

export function commitDetachedCodeEditorChange(
  nodes: Node[],
  target: CodeEditorTarget,
  nextValue: string,
  setNodes: (nodes: Node[]) => void
): void {
  const nextNodes = nodes.map((candidate) =>
    candidate.id === target.nodeId
      ? {
          ...candidate,
          data: {
            ...candidate.data,
            [target.dataKey]: nextValue
          }
        }
      : candidate
  );

  setNodes(nextNodes);
  target.onchange?.(nextValue);
}
