import type { SettingsSidebarTarget } from '../../stores/settings-sidebar.store';
import { hasVisibleSettingsFields } from './visibility';
import {
  isSchemaSettingsSidebarTarget,
  openObjectSettingsInSidebarIfPreferred,
  registerSettingsSidebarTarget
} from '../../stores/settings-sidebar.store';

export interface FloatingSettingsController {
  isOpen: () => boolean;
  setOpen: (open: boolean) => void;
  onOpenFloating?: () => void;
}

export interface SettingsSidebarTargetOptions {
  getTarget: () => SettingsSidebarTarget | null;
  floating: FloatingSettingsController;
}

/**
 * Registers a schema-backed node with the Settings sidebar and routes Settings
 * actions to the preferred floating or sidebar surface.
 */
export function useSettingsSidebarTarget({ getTarget, floating }: SettingsSidebarTargetOptions): {
  toggle: (event?: MouseEvent) => void;
} {
  $effect(() => {
    const target = getTarget();
    if (
      !target ||
      (isSchemaSettingsSidebarTarget(target) && !hasVisibleSettingsFields(target.schema))
    )
      return;

    return registerSettingsSidebarTarget(target);
  });

  function toggle(event?: MouseEvent): void {
    const target = getTarget();
    if (!target) return;

    if (openObjectSettingsInSidebarIfPreferred(target.id, event?.shiftKey)) {
      floating.setOpen(false);
      return;
    }

    const nextOpen = !floating.isOpen();
    floating.setOpen(nextOpen);

    if (nextOpen) floating.onOpenFloating?.();
  }

  return { toggle };
}
