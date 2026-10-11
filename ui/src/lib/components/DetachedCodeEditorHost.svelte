<script lang="ts">
  import { resolveEditorFontSizes } from '$lib/editor-appearance/editor-appearance';
  import { editorFontSize } from '../../stores/editor.store';
  import CodeEditor from './CodeEditor.svelte';
  import DetachedCodeEditorOverlay from './DetachedCodeEditorOverlay.svelte';
  import type { CodeEditorTarget } from '../../stores/code-editor-layout.store';

  let {
    target,
    hasNode,
    value,
    onchange,
    onClose,
    fontSize
  }: {
    target: CodeEditorTarget | null;
    hasNode: boolean;
    value: string;
    onchange: (value: string) => void;
    onClose: () => void;
    fontSize: number;
  } = $props();
</script>

<!-- Keep the outgoing target available when CodeMirror blurs during teardown. -->
{#each target?.mode === 'overlay' && hasNode ? [target] : [] as editorTarget (`${editorTarget.nodeId}:${editorTarget.dataKey}`)}
  {@const appearance = editorTarget.getAppearance?.()}
  {@const fontSizes = appearance
    ? resolveEditorFontSizes(appearance, $editorFontSize, fontSize)
    : undefined}
  {#snippet detachedCodeEditorSnippet()}
    <CodeEditor
      {value}
      {onchange}
      language={editorTarget.language}
      nodeType={editorTarget.nodeType}
      placeholder={editorTarget.placeholder ?? ''}
      class="nodrag nopan nowheel h-full w-full resize-none"
      onrun={editorTarget.onrun}
      nodeId={editorTarget.nodeId}
      dataKey={editorTarget.dataKey}
      lineErrors={editorTarget.lineErrors}
      inlineDecorations={editorTarget.inlineDecorations}
      extraExtensions={editorTarget.extraExtensions}
      onaltdecorationclick={editorTarget.onAltDecorationClick}
      lineWrap={editorTarget.lineWrap}
      fontSize={`${fontSizes?.expanded ?? fontSize}px`}
      fontFamily={appearance?.fontFamily}
    />
  {/snippet}

  <DetachedCodeEditorOverlay
    {onClose}
    containerStyle={appearance?.styles?.container}
    onrun={editorTarget.onrun}
    nodeId={editorTarget.nodeId}
    settings={editorTarget.settings}
    console={editorTarget.console}
    customActions={editorTarget.customActions}
    customSettings={editorTarget.customSettings}
    codeEditor={detachedCodeEditorSnippet}
  />
{/each}
