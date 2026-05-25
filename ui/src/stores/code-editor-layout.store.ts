import { get, writable } from 'svelte/store';
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
  onrun?: () => void;
  settings?: CodeEditorTargetSettings;
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

export function isDetachedCodeEditorTarget(nodeId: string | undefined, dataKey: string): boolean {
  if (!nodeId) return false;

  const target = get(activeCodeEditorTarget);

  return target?.nodeId === nodeId && target.dataKey === dataKey;
}
