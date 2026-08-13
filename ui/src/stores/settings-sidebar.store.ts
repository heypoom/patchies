import type { Snippet } from 'svelte';
import { get, writable } from 'svelte/store';
import type { SettingsSchema } from '$lib/settings';
import { isSidebarOpen, sidebarView } from './ui.store';
import { showSidebarTab } from './sidebar-visibility.store';
import { openObjectSettingsInSidebar } from './editor-layout-settings.store';

interface SettingsSidebarTargetBase {
  id: string;
  label: string;
}

export interface SchemaSettingsSidebarTarget extends SettingsSidebarTargetBase {
  schema: SettingsSchema;
  values: Record<string, unknown>;
  onValueChange: (key: string, value: unknown) => void;
  onRevertAll: () => void;
}

export interface CustomSettingsSidebarTarget extends SettingsSidebarTargetBase {
  /** Object-specific settings UI rendered by the sidebar. */
  content: Snippet;
}

export type SettingsSidebarTarget = SchemaSettingsSidebarTarget | CustomSettingsSidebarTarget;

export function isSchemaSettingsSidebarTarget(
  target: SettingsSidebarTarget
): target is SchemaSettingsSidebarTarget {
  return 'schema' in target;
}

/**
 * Settings views register their live schema callbacks or bespoke content here
 * so the sidebar can edit a node without coupling to its implementation.
 */
export const settingsSidebarTargets = writable<Map<string, SettingsSidebarTarget>>(new Map());

/** Set when a node action explicitly opens its settings in the sidebar. */
export const requestSettingsSidebarTargetId = writable<string | null>(null);

export interface SettingsSidebarSelectionState {
  activeTargetId: string | null;
  pinnedTargetId: string | null;
  lastSelectedNodeId: string | null;
}

/** Preserves Settings sidebar target choice while its tab is unmounted. */
export const settingsSidebarSelection = writable<SettingsSidebarSelectionState>({
  activeTargetId: null,
  pinnedTargetId: null,
  lastSelectedNodeId: null
});

export function registerSettingsSidebarTarget(target: SettingsSidebarTarget): () => void {
  settingsSidebarTargets.update((targets) => {
    const next = new Map(targets);
    next.set(target.id, target);

    return next;
  });

  return () => {
    settingsSidebarTargets.update((targets) => {
      const current = targets.get(target.id);
      if (current !== target) return targets;

      const next = new Map(targets);
      next.delete(target.id);

      return next;
    });
  };
}

/**
 * Opens the Settings sidebar when the user has opted into that behavior.
 * Holding Shift inverts the preferred destination for a one-off settings action.
 *
 * Returns whether the caller's settings action was handled by the sidebar.
 */
export function openObjectSettingsInSidebarIfPreferred(nodeId: string, shiftKey = false): boolean {
  if (get(openObjectSettingsInSidebar) === shiftKey) return false;

  showSidebarTab('settings');
  requestSettingsSidebarTargetId.set(nodeId);
  sidebarView.set('settings');
  isSidebarOpen.set(true);

  return true;
}
