import { fromStore } from 'svelte/store';

import {
  activeCodeEditorTarget,
  isCodeEditorOverlayTarget
} from '../../stores/code-editor-layout.store';

/** Reactively reports whether this code field is open in the detached overlay. */
export function useCodeEditorOverlayTarget(
  getNodeId: () => string | undefined,
  getDataKey: () => string
): { readonly isOpen: boolean } {
  const activeTarget = fromStore(activeCodeEditorTarget);

  return {
    get isOpen() {
      return isCodeEditorOverlayTarget(activeTarget.current, getNodeId(), getDataKey());
    }
  };
}
