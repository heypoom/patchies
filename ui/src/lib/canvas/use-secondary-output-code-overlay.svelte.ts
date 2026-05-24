import type { Node } from '@xyflow/svelte';
import type { CodeEditorTarget } from '../../stores/code-editor-layout.store';
import {
  createCodeOverlayMirrorState,
  createDetachedStrudelCodeOverlayMirrorState,
  type CodeOverlayMirrorState
} from './secondary-output-ipc';

type SecondaryOutputCodeOverlayOptions = {
  getNodes: () => Node[];
  getActiveDetachedStrudelNodeId: () => string | null;
  getActiveCodeEditorTarget: () => CodeEditorTarget | null;
  getDetachedCodeEditorValue: () => string;
  getFontSizePx: () => number;
  getTransparency: () => number;
  sendCodeOverlayState: (state: CodeOverlayMirrorState | null) => void;
};

type SecondaryOutputCodeOverlayStateOptions = {
  nodes: Node[];
  activeDetachedStrudelNodeId: string | null;
  activeCodeEditorTarget: CodeEditorTarget | null;
  detachedCodeEditorValue: string;
  fontSizePx: number;
  transparency: number;
};

export function useSecondaryOutputCodeOverlay({
  getNodes,
  getActiveDetachedStrudelNodeId,
  getActiveCodeEditorTarget,
  getDetachedCodeEditorValue,
  getFontSizePx,
  getTransparency,
  sendCodeOverlayState
}: SecondaryOutputCodeOverlayOptions) {
  $effect(() => {
    sendCodeOverlayState(
      getSecondaryOutputCodeOverlayState({
        nodes: getNodes(),
        activeDetachedStrudelNodeId: getActiveDetachedStrudelNodeId(),
        activeCodeEditorTarget: getActiveCodeEditorTarget(),
        detachedCodeEditorValue: getDetachedCodeEditorValue(),
        fontSizePx: getFontSizePx(),
        transparency: getTransparency()
      })
    );
  });
}

export function getSecondaryOutputCodeOverlayState({
  nodes,
  activeDetachedStrudelNodeId,
  activeCodeEditorTarget,
  detachedCodeEditorValue,
  fontSizePx,
  transparency
}: SecondaryOutputCodeOverlayStateOptions): CodeOverlayMirrorState | null {
  const detachedStrudelNode =
    activeDetachedStrudelNodeId === null
      ? undefined
      : nodes.find((node) => node.id === activeDetachedStrudelNodeId);

  const detachedStrudelCode = detachedStrudelNode?.data?.code;

  if (activeDetachedStrudelNodeId && typeof detachedStrudelCode === 'string') {
    return createDetachedStrudelCodeOverlayMirrorState(
      activeDetachedStrudelNodeId,
      detachedStrudelCode,
      fontSizePx,
      transparency
    );
  }

  return createCodeOverlayMirrorState(
    activeCodeEditorTarget,
    detachedCodeEditorValue,
    fontSizePx,
    transparency
  );
}
