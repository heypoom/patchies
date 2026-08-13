import { fromStore } from 'svelte/store';
import { untrack } from 'svelte';

import { selectedNodeInfo } from '../../stores/ui.store';
import { activateCodeEditorSidebarTarget } from '../../stores/code-editor-layout.store';

import {
  codeSidebarTargets,
  codeSidebarSelection,
  registerCodeSidebarTarget,
  requestCodeSidebarTargetId,
  type CodeSidebarTarget
} from '../../stores/code-sidebar.store';
import { useSidebarSelectionState } from '$lib/sidebar/use-sidebar-selection-state.svelte';

/** Registers a code accessor so the Code sidebar can follow canvas selection. */
export function useCodeSidebarTarget(getTarget: () => CodeSidebarTarget | null): void {
  $effect(() => {
    const target = getTarget();
    if (!target) return;

    return registerCodeSidebarTarget(target);
  });
}

export function useCodeSidebarTargetSelection(): {
  readonly targets: CodeSidebarTarget[];
  readonly activeTarget: CodeSidebarTarget | null;
  readonly pinnedTargetId: string | null;
  selectTarget: (targetId: string) => void;
  togglePin: () => void;
} {
  const targetsSource = fromStore(codeSidebarTargets);

  const { state: selectionState, update: updateSelectionState } =
    useSidebarSelectionState(codeSidebarSelection);

  const requestedTargetId = fromStore(requestCodeSidebarTargetId);
  const selectedNode = fromStore(selectedNodeInfo);

  const targets = $derived(
    [...targetsSource.current.values()].sort((a, b) => a.label.localeCompare(b.label))
  );

  const activeTarget = $derived(
    selectionState.current.activeTargetId
      ? (targets.find((target) => target.nodeId === selectionState.current.activeTargetId) ?? null)
      : null
  );

  $effect(() => {
    const { activeTargetId, pinnedTargetId, lastSelectedNodeId, lastSelectedNodeTargetId } =
      untrack(() => selectionState.current);

    const requestedId = requestedTargetId.current;

    const requestedTarget = requestedId
      ? targets.find((target) => target.nodeId === requestedId)
      : undefined;

    if (requestedTarget) {
      updateSelectionState({ activeTargetId: requestedTarget.nodeId });
      activateCodeEditorSidebarTarget(requestedTarget);
      requestCodeSidebarTargetId.set(null);

      return;
    }

    const pinnedTarget = pinnedTargetId
      ? targets.find((target) => target.nodeId === pinnedTargetId)
      : undefined;

    if (pinnedTarget) {
      updateSelectionState({ activeTargetId: pinnedTarget.nodeId });
      activateCodeEditorSidebarTarget(pinnedTarget);

      return;
    }

    if (pinnedTargetId) {
      updateSelectionState({ pinnedTargetId: null });
    }

    const selectedId = selectedNode.current?.id ?? null;
    const selectionChanged = selectedId !== lastSelectedNodeId;

    const selectedTarget = selectedId
      ? targets.find((target) => target.nodeId === selectedId)
      : undefined;

    const selectedTargetRegisteredAfterSelection =
      selectedTarget !== undefined && lastSelectedNodeTargetId === null;

    if (selectedTarget && (selectionChanged || selectedTargetRegisteredAfterSelection)) {
      updateSelectionState({ activeTargetId: selectedTarget.nodeId });
      activateCodeEditorSidebarTarget(selectedTarget);
    } else if (!activeTargetId || !targets.some((target) => target.nodeId === activeTargetId)) {
      updateSelectionState({ activeTargetId: targets[0]?.nodeId ?? null });

      if (targets[0]) {
        activateCodeEditorSidebarTarget(targets[0]);
      }
    }

    updateSelectionState({
      lastSelectedNodeId: selectedId,
      lastSelectedNodeTargetId: selectedTarget?.nodeId ?? null
    });
  });

  return {
    selectTarget: (targetId) => {
      updateSelectionState({ activeTargetId: targetId });

      const target = targets.find((candidate) => candidate.nodeId === targetId);
      if (target) activateCodeEditorSidebarTarget(target);
    },
    togglePin: () => {
      updateSelectionState({
        pinnedTargetId: selectionState.current.pinnedTargetId
          ? null
          : selectionState.current.activeTargetId
      });
    },
    get targets() {
      return targets;
    },
    get activeTarget() {
      return activeTarget;
    },
    get pinnedTargetId() {
      return selectionState.current.pinnedTargetId;
    }
  };
}
