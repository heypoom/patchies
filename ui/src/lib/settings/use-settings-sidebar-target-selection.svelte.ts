import { fromStore } from 'svelte/store';
import { untrack } from 'svelte';

import { selectedNodeInfo } from '../../stores/ui.store';

import {
  requestSettingsSidebarTargetId,
  settingsSidebarSelection,
  settingsSidebarTargets,
  type SettingsSidebarTarget
} from '../../stores/settings-sidebar.store';
import { useSidebarSelectionState } from '$lib/sidebar/use-sidebar-selection-state.svelte';

export function useSettingsSidebarTargetSelection(): {
  readonly targets: SettingsSidebarTarget[];
  readonly activeTarget: SettingsSidebarTarget | null;
  readonly pinnedTargetId: string | null;
  selectTarget: (targetId: string) => void;
  togglePin: () => void;
} {
  const sidebarTargets = fromStore(settingsSidebarTargets);

  const { state: selectionState, update: updateSelectionState } =
    useSidebarSelectionState(settingsSidebarSelection);

  const requestedTargetId = fromStore(requestSettingsSidebarTargetId);
  const selectedNode = fromStore(selectedNodeInfo);

  const targets = $derived(
    [...sidebarTargets.current.values()].sort((a, b) => a.label.localeCompare(b.label))
  );

  const activeTarget = $derived(
    selectionState.current.activeTargetId
      ? (targets.find((target) => target.id === selectionState.current.activeTargetId) ?? null)
      : null
  );

  $effect(() => {
    const { activeTargetId, pinnedTargetId, lastSelectedNodeId } = untrack(
      () => selectionState.current
    );
    const requestedId = requestedTargetId.current;

    const requestedTarget = requestedId
      ? targets.find((target) => target.id === requestedId)
      : undefined;

    if (requestedTarget) {
      updateSelectionState({ activeTargetId: requestedTarget.id });
      requestSettingsSidebarTargetId.set(null);
      return;
    }

    const pinnedTarget = pinnedTargetId
      ? targets.find((target) => target.id === pinnedTargetId)
      : undefined;

    if (pinnedTarget) {
      updateSelectionState({ activeTargetId: pinnedTarget.id });
      return;
    }

    if (pinnedTargetId) updateSelectionState({ pinnedTargetId: null });

    const selectedTarget = selectedNode.current
      ? targets.find((target) => target.id === selectedNode.current?.id)
      : undefined;

    const selectedNodeId = selectedNode.current?.id ?? null;

    if (selectedTarget && selectedNodeId !== lastSelectedNodeId) {
      updateSelectionState({ activeTargetId: selectedTarget.id });
    } else if (!activeTargetId || !targets.some((target) => target.id === activeTargetId)) {
      updateSelectionState({ activeTargetId: targets[0]?.id ?? null });
    }

    updateSelectionState({ lastSelectedNodeId: selectedNodeId });
  });

  function selectTarget(targetId: string): void {
    updateSelectionState({ activeTargetId: targetId });
  }

  function togglePin(): void {
    updateSelectionState({
      pinnedTargetId: selectionState.current.pinnedTargetId
        ? null
        : selectionState.current.activeTargetId
    });
  }

  return {
    selectTarget,
    togglePin,

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
