import { writable } from 'svelte/store';
import type { CodeEditorTarget } from './code-editor-layout.store';

export interface CodeSidebarTarget extends Omit<CodeEditorTarget, 'mode'> {
  label: string;
  value: string;
}

/** Live code-editor accessors registered by code-capable nodes. */
export const codeSidebarTargets = writable<Map<string, CodeSidebarTarget>>(new Map());

/** Set when an explicit Code action opens a node in the sidebar. */
export const requestCodeSidebarTargetId = writable<string | null>(null);

export interface CodeSidebarSelectionState {
  activeTargetId: string | null;
  pinnedTargetId: string | null;
  lastSelectedNodeId: string | null;
  lastSelectedNodeTargetId: string | null;
}

/** Preserves Code sidebar target choice while its tab is unmounted. */
export const codeSidebarSelection = writable<CodeSidebarSelectionState>({
  activeTargetId: null,
  pinnedTargetId: null,
  lastSelectedNodeId: null,
  lastSelectedNodeTargetId: null
});

export function registerCodeSidebarTarget(target: CodeSidebarTarget): () => void {
  codeSidebarTargets.update((targets) => {
    const next = new Map(targets);
    next.set(target.nodeId, target);

    return next;
  });

  return () => {
    codeSidebarTargets.update((targets) => {
      if (targets.get(target.nodeId) !== target) return targets;

      const next = new Map(targets);
      next.delete(target.nodeId);

      return next;
    });
  };
}
