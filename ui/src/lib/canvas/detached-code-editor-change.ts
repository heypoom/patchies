import type { CodeEditorTarget } from '../../stores/code-editor-layout.store';

type UpdateNodeData = (nodeId: string, data: Record<string, string>) => void;

export function commitDetachedCodeEditorChange(
  target: CodeEditorTarget,
  nextValue: string,
  updateNodeData: UpdateNodeData
): void {
  updateNodeData(target.nodeId, { [target.dataKey]: nextValue });
  target.onchange?.(nextValue);
}
