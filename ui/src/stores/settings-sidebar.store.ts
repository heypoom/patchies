import { get, writable } from 'svelte/store';
import type { SettingsSchema } from '$lib/settings';
import { isSidebarOpen, sidebarView } from './ui.store';
import { showSidebarTab } from './sidebar-visibility.store';
import { openObjectSettingsInSidebar } from './editor-layout-settings.store';

export interface SettingsSidebarTarget {
  id: string;
  label: string;
  schema: SettingsSchema;
  values: Record<string, unknown>;
  onValueChange: (key: string, value: unknown) => void;
  onRevertAll: () => void;
}

/**
 * Settings-schema views register their live callbacks here so the sidebar can
 * edit a node without coupling to a particular object implementation.
 */
export const settingsSidebarTargets = writable<Map<string, SettingsSidebarTarget>>(new Map());

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
 *
 * Returns whether the caller's settings action was handled by the sidebar.
 */
export function openObjectSettingsInSidebarIfPreferred(): boolean {
  if (!get(openObjectSettingsInSidebar)) return false;

  showSidebarTab('settings');
  sidebarView.set('settings');
  isSidebarOpen.set(true);

  return true;
}
