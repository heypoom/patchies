<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Extension } from '@codemirror/state';
  import CodeEditor from '$lib/components/CodeEditor.svelte';
  import MusicCodeContainer from './MusicCodeContainer.svelte';
  import type { MusicCodeLayoutData } from './music-code-layout';
  import { useCodeSidebarTarget } from '$lib/code-editor/use-code-sidebar-target.svelte';
  import { useCodeEditorOverlayTarget } from '$lib/code-editor/use-code-editor-overlay-target.svelte';
  import {
    closeCodeEditorOverlay,
    openCodeEditorOverlay,
    openCodeEditorSidebar
  } from '../../stores/code-editor-layout.store';

  let {
    nodeId,
    data,
    selected,
    value,
    label,
    placeholder = '',
    status,
    actions,
    menu,
    handles,
    outlets,
    sidePanel,
    detachedActions,
    detachedSettings,
    extraExtensions = [],
    onchange,
    onrun
  }: {
    nodeId: string;
    data: MusicCodeLayoutData;
    selected: boolean;
    value: string;
    label: string;
    placeholder?: string;
    status?: string;
    actions?: Snippet;
    menu?: Snippet;
    handles?: Snippet;
    outlets?: Snippet;
    sidePanel?: Snippet;
    detachedActions?: Snippet;
    detachedSettings?: Snippet;
    extraExtensions?: Extension[];
    onchange: (value: string) => void;
    onrun: (code?: string) => void;
  } = $props();

  const overlay = useCodeEditorOverlayTarget(
    () => nodeId,
    () => 'expr'
  );

  const getTarget = () => ({
    nodeId,
    dataKey: 'expr',
    language: 'javascript' as const,
    nodeType: label,
    label,
    title: label,
    placeholder,
    value,
    onchange,
    onrun,
    extraExtensions,
    customActions: detachedActions,
    customSettings: detachedSettings
  });

  useCodeSidebarTarget(getTarget);

  export const openExpandedEditor = () => openCodeEditorOverlay(getTarget());
  const openSidebar = () => openCodeEditorSidebar(getTarget());

  export function closeExpandedEditor() {
    if (overlay.isOpen) closeCodeEditorOverlay();
  }
</script>

<MusicCodeContainer
  {nodeId}
  {data}
  {selected}
  {label}
  {status}
  {actions}
  {menu}
  {handles}
  {outlets}
  {sidePanel}
  expanded={overlay.isOpen}
  onExpand={openExpandedEditor}
  onOpenSidebar={openSidebar}
>
  {#if !overlay.isOpen}
    <CodeEditor
      {value}
      {onchange}
      {onrun}
      {placeholder}
      {extraExtensions}
      {nodeId}
      dataKey="expr"
      language="javascript"
      nodeType={label}
      class="h-full w-full"
    />
  {/if}
</MusicCodeContainer>
