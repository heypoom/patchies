import { fromStore } from 'svelte/store';

import { selectedNodeInfo } from '../../stores/ui.store';
import { activateCodeEditorSidebarTarget } from '../../stores/code-editor-layout.store';

import {
  codeSidebarTargets,
  registerCodeSidebarTarget,
  requestCodeSidebarTargetId,
  type CodeSidebarTarget
} from '../../stores/code-sidebar.store';

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
  const requestedTargetId = fromStore(requestCodeSidebarTargetId);
  const selectedNode = fromStore(selectedNodeInfo);

  let activeTargetId = $state<string | null>(null);
  let pinnedTargetId = $state<string | null>(null);
  let lastSelectedNodeId = $state<string | null>(null);
  let lastSelectedNodeTargetId = $state<string | null>(null);

  const targets = $derived(
    [...targetsSource.current.values()].sort((a, b) => a.label.localeCompare(b.label))
  );

  const activeTarget = $derived(
    activeTargetId ? (targets.find((target) => target.nodeId === activeTargetId) ?? null) : null
  );

  $effect(() => {
    const requestedId = requestedTargetId.current;

    const requestedTarget = requestedId
      ? targets.find((target) => target.nodeId === requestedId)
      : undefined;

    if (requestedTarget) {
      activeTargetId = requestedTarget.nodeId;
      activateCodeEditorSidebarTarget(requestedTarget);
      requestCodeSidebarTargetId.set(null);

      return;
    }

    const pinnedTarget = pinnedTargetId
      ? targets.find((target) => target.nodeId === pinnedTargetId)
      : undefined;

    if (pinnedTarget) {
      activeTargetId = pinnedTarget.nodeId;
      activateCodeEditorSidebarTarget(pinnedTarget);

      return;
    }

    if (pinnedTargetId) {
      pinnedTargetId = null;
    }

    const selectedId = selectedNode.current?.id ?? null;
    const selectionChanged = selectedId !== lastSelectedNodeId;

    const selectedTarget = selectedId
      ? targets.find((target) => target.nodeId === selectedId)
      : undefined;

    const selectedTargetRegisteredAfterSelection =
      selectedTarget !== undefined && lastSelectedNodeTargetId === null;

    if (selectedTarget && (selectionChanged || selectedTargetRegisteredAfterSelection)) {
      activeTargetId = selectedTarget.nodeId;
      activateCodeEditorSidebarTarget(selectedTarget);
    } else if (!activeTargetId || !targets.some((target) => target.nodeId === activeTargetId)) {
      activeTargetId = targets[0]?.nodeId ?? null;

      if (targets[0]) {
        activateCodeEditorSidebarTarget(targets[0]);
      }
    }

    lastSelectedNodeId = selectedId;
    lastSelectedNodeTargetId = selectedTarget?.nodeId ?? null;
  });

  return {
    selectTarget: (targetId) => {
      activeTargetId = targetId;

      const target = targets.find((candidate) => candidate.nodeId === targetId);
      if (target) activateCodeEditorSidebarTarget(target);
    },
    togglePin: () => {
      pinnedTargetId = pinnedTargetId ? null : activeTargetId;
    },
    get targets() {
      return targets;
    },
    get activeTarget() {
      return activeTarget;
    },
    get pinnedTargetId() {
      return pinnedTargetId;
    }
  };
}
