import { get, writable } from 'svelte/store';
import type { Snippet } from 'svelte';
import type { SupportedLanguage } from '$lib/codemirror/types';
import type { SettingsSchema } from '$lib/settings';
import { isSidebarOpen, sidebarView } from './ui.store';
import { showSidebarTab } from './sidebar-visibility.store';

export interface CodeEditorTargetSettings {
  schema: SettingsSchema;
  values: Record<string, unknown>;
  onValueChange: (key: string, value: unknown) => void;
  onRevertAll: () => void;
  settingsPrefix?: string;
}

export interface CodeEditorTarget {
  nodeId: string;
  dataKey: string;
  language: SupportedLanguage;
  nodeType?: string;
  title?: string;
  placeholder?: string;
  onchange?: (value: string) => void | Promise<void>;
  onrun?: () => void;
  settings?: CodeEditorTargetSettings;
  customActions?: Snippet;
  customSettings?: Snippet;
  mode: 'overlay' | 'sidebar';
}

export type OpenCodeEditorOverlayTarget = Omit<CodeEditorTarget, 'mode'>;
export type OpenCodeEditorSidebarTarget = Omit<CodeEditorTarget, 'mode'>;

export const activeCodeEditorTarget = writable<CodeEditorTarget | null>(null);

export function openCodeEditorOverlay(target: OpenCodeEditorOverlayTarget): void {
  activeCodeEditorTarget.set({ ...target, mode: 'overlay' });
  isSidebarOpen.set(false);
}

export function openCodeEditorSidebar(target: OpenCodeEditorSidebarTarget): void {
  activeCodeEditorTarget.set({ ...target, mode: 'sidebar' });
  showSidebarTab('code');
  sidebarView.set('code');
  isSidebarOpen.set(true);
}

export function closeCodeEditorOverlay(): void {
  activeCodeEditorTarget.set(null);
}

interface CodeEditorTargetSettingsState {
  settings?: CodeEditorTargetSettings;
  customSettings?: Snippet;
}

export function hasCodeEditorTargetSettings(
  target: CodeEditorTarget | CodeEditorTargetSettingsState | null | undefined
): boolean {
  if (!target) return false;

  if (target.customSettings) return true;

  return (target.settings?.schema.length ?? 0) > 0;
}

export function isDetachedCodeEditorTarget(nodeId: string | undefined, dataKey: string): boolean {
  if (!nodeId) return false;

  const target = get(activeCodeEditorTarget);

  return target?.nodeId === nodeId && target.dataKey === dataKey;
}
