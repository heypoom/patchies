import type { SupportedLanguage } from '$lib/codemirror/types';
import type { Snippet } from 'svelte';
import type { OpenCodeEditorOverlayTarget } from '../../stores/code-editor-layout.store';

interface CommonExprEditorTargetOptions {
  nodeId: string;
  dataKey: string;
  language: SupportedLanguage;
  nodeType?: string;
  title?: string;
  placeholder?: string;
  onchange?: (value: string) => void | Promise<void>;
  onrun?: () => void;
  customActions?: Snippet;
  customSettings?: Snippet;
}

export function createCommonExprEditorTarget({
  nodeId,
  dataKey,
  language,
  nodeType,
  title,
  placeholder,
  onchange,
  onrun,
  customActions,
  customSettings
}: CommonExprEditorTargetOptions): OpenCodeEditorOverlayTarget {
  return {
    nodeId,
    dataKey,
    language,
    nodeType,
    title,
    placeholder,
    onchange,
    onrun,
    customActions,
    customSettings
  };
}
