import {
  CircleHelp,
  Code,
  Eye,
  EyeOff,
  Expand,
  Monitor,
  MonitorOff,
  Pin,
  PinOff,
  Play,
  Settings,
  Shrink
} from '@lucide/svelte/icons';
import type { SettingsSchema } from '$lib/settings';
import type { Component } from 'svelte';

export interface ExtraMenuItem {
  label: string;
  icon: Component<{ class?: string }>;
  onclick: () => void;
  variant?: 'default' | 'danger';
}

export interface ObjectPreviewMenuProps {
  onrun?: () => void;
  settingsSchema?: SettingsSchema;
  showSettings?: boolean;
  showBgOutputOption?: boolean;
  nodeId?: string;
  isOutputOverride?: boolean;
  showPauseButton?: boolean;
  paused?: boolean;
  canPin?: boolean;
  onPreviewToggle?: () => void;
  previewVisible?: boolean;
  onSettingsToggle?: () => void;
  onCodeToggle?: (event: MouseEvent) => void;
  onExpandToggle?: () => void;
  isExpanded?: boolean;
  onBgOutputToggle?: () => void;
  onPlaybackToggle?: () => void;
  onOpenHelp: () => void;
  extraMenuItems?: ExtraMenuItem[];
}

export type ObjectPreviewMenuActionVariant = 'default' | 'danger' | 'warning';

export interface ObjectPreviewMenuAction {
  id: string;
  label: string;
  icon: Component<{ class?: string }>;
  onclick: (event: MouseEvent) => void;
  variant?: ObjectPreviewMenuActionVariant;
  disabled?: boolean;
}

export interface ObjectPreviewMenuGroup {
  id: string;
  actions: ObjectPreviewMenuAction[];
}

function hasSettings(settingsSchema?: SettingsSchema) {
  return settingsSchema !== undefined && settingsSchema.length > 0;
}

export function getObjectPreviewMenuGroups({
  onrun,
  settingsSchema,
  showSettings = false,
  showBgOutputOption = false,
  nodeId,
  isOutputOverride = false,
  showPauseButton = false,
  paused = false,
  canPin = false,
  onPreviewToggle,
  previewVisible = true,
  onSettingsToggle,
  onCodeToggle,
  onExpandToggle,
  isExpanded = false,
  onBgOutputToggle,
  onPlaybackToggle,
  onOpenHelp,
  extraMenuItems
}: ObjectPreviewMenuProps): ObjectPreviewMenuGroup[] {
  const topActions: ObjectPreviewMenuAction[] = [];

  if (onrun) {
    topActions.push({
      id: 'run',
      label: 'Run',
      icon: Play,
      onclick: () => onrun()
    });
  }

  if (hasSettings(settingsSchema) && onSettingsToggle) {
    topActions.push({
      id: 'settings',
      label: showSettings ? 'Hide settings' : 'Settings',
      icon: Settings,
      onclick: () => onSettingsToggle()
    });
  }

  for (const [index, item] of extraMenuItems?.entries() ?? []) {
    topActions.push({
      id: `extra-${index}`,
      label: item.label,
      icon: item.icon,
      onclick: () => item.onclick(),
      variant: item.variant
    });
  }

  const outputActions: ObjectPreviewMenuAction[] = [];

  if (onCodeToggle) {
    outputActions.push({
      id: 'code',
      label: 'Edit code',
      icon: Code,
      onclick: onCodeToggle
    });
  }

  if (showBgOutputOption && nodeId !== undefined && onBgOutputToggle) {
    outputActions.push({
      id: 'background-output',
      label: isOutputOverride ? 'Hide output' : 'Use as output',
      icon: isOutputOverride ? MonitorOff : Monitor,
      onclick: () => onBgOutputToggle(),
      variant: isOutputOverride ? 'warning' : 'default'
    });
  }

  const displayActions: ObjectPreviewMenuAction[] = [];

  if (onExpandToggle) {
    displayActions.push({
      id: 'expand',
      label: isExpanded ? 'Exit expanded' : 'Expand',
      icon: isExpanded ? Shrink : Expand,
      onclick: () => onExpandToggle(),
      variant: isExpanded ? 'danger' : 'default'
    });
  }

  if (showPauseButton && onPlaybackToggle) {
    displayActions.push({
      id: 'playback',
      label: paused ? 'Unfreeze frame' : 'Freeze frame',
      icon: paused ? PinOff : Pin,
      onclick: () => onPlaybackToggle(),
      variant: paused ? 'danger' : 'default',
      disabled: !canPin && !paused
    });
  }

  if (onPreviewToggle) {
    displayActions.push({
      id: 'preview',
      label: previewVisible ? 'Hide preview' : 'Show preview',
      icon: previewVisible ? EyeOff : Eye,
      onclick: () => onPreviewToggle()
    });
  }

  const helpActions: ObjectPreviewMenuAction[] = [
    {
      id: 'help',
      label: 'Help',
      icon: CircleHelp,
      onclick: () => onOpenHelp()
    }
  ];

  return [
    { id: 'top', actions: topActions },
    { id: 'output', actions: outputActions },
    { id: 'display', actions: displayActions },
    { id: 'help', actions: helpActions }
  ].filter((group) => group.actions.length > 0);
}
