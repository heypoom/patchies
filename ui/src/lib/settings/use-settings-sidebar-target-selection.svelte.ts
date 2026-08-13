import { fromStore } from 'svelte/store';

import { selectedNodeInfo } from '../../stores/ui.store';

import {
  requestSettingsSidebarTargetId,
  settingsSidebarTargets,
  type SettingsSidebarTarget
} from '../../stores/settings-sidebar.store';

export function useSettingsSidebarTargetSelection(): {
  readonly targets: SettingsSidebarTarget[];
  readonly activeTarget: SettingsSidebarTarget | null;
  readonly pinnedTargetId: string | null;
  selectTarget: (targetId: string) => void;
  togglePin: () => void;
} {
  let activeTargetId = $state<string | null>(null);
  let pinnedTargetId = $state<string | null>(null);
  let lastSelectedNodeId = $state<string | null>(null);

  const sidebarTargets = fromStore(settingsSidebarTargets);
  const requestedTargetId = fromStore(requestSettingsSidebarTargetId);
  const selectedNode = fromStore(selectedNodeInfo);

  const targets = $derived(
    [...sidebarTargets.current.values()].sort((a, b) => a.label.localeCompare(b.label))
  );

  const activeTarget = $derived(
    activeTargetId ? (targets.find((target) => target.id === activeTargetId) ?? null) : null
  );

  $effect(() => {
    const requestedId = requestedTargetId.current;

    const requestedTarget = requestedId
      ? targets.find((target) => target.id === requestedId)
      : undefined;

    if (requestedTarget) {
      activeTargetId = requestedTarget.id;
      requestSettingsSidebarTargetId.set(null);
      return;
    }

    const pinnedTarget = pinnedTargetId
      ? targets.find((target) => target.id === pinnedTargetId)
      : undefined;

    if (pinnedTarget) {
      activeTargetId = pinnedTarget.id;
      return;
    }

    if (pinnedTargetId) pinnedTargetId = null;

    const selectedTarget = selectedNode.current
      ? targets.find((target) => target.id === selectedNode.current?.id)
      : undefined;

    const selectedNodeId = selectedNode.current?.id ?? null;

    if (selectedTarget && selectedNodeId !== lastSelectedNodeId) {
      activeTargetId = selectedTarget.id;
    } else if (!activeTargetId || !targets.some((target) => target.id === activeTargetId)) {
      activeTargetId = targets[0]?.id ?? null;
    }

    lastSelectedNodeId = selectedNodeId;
  });

  function selectTarget(targetId: string): void {
    activeTargetId = targetId;
  }

  function togglePin(): void {
    pinnedTargetId = pinnedTargetId ? null : activeTargetId;
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
      return pinnedTargetId;
    }
  };
}
