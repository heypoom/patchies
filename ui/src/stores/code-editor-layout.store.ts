import { get, writable } from 'svelte/store';
import type { SupportedLanguage } from '$lib/codemirror/types';

export interface CodeEditorTarget {
  nodeId: string;
  dataKey: string;
  language: SupportedLanguage;
  nodeType?: string;
  title?: string;
  placeholder?: string;
  onrun?: () => void;
  mode: 'overlay' | 'sidebar';
}

export type OpenCodeEditorOverlayTarget = Omit<CodeEditorTarget, 'mode'>;

export const activeCodeEditorTarget = writable<CodeEditorTarget | null>(null);

export function openCodeEditorOverlay(target: OpenCodeEditorOverlayTarget): void {
  activeCodeEditorTarget.set({ ...target, mode: 'overlay' });
}

export function closeCodeEditorOverlay(): void {
  activeCodeEditorTarget.set(null);
}

export function isDetachedCodeEditorTarget(nodeId: string | undefined, dataKey: string): boolean {
  if (!nodeId) return false;

  const target = get(activeCodeEditorTarget);

  return target?.nodeId === nodeId && target.dataKey === dataKey;
}
