<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import { useNodeDataTracker } from '$lib/history';
  import {
    editorFontFamily,
    editorFontSize,
    editorFullscreenFontSize
  } from '../../stores/editor.store';
  import { resolveEditorFontSizes, type EditorAppearanceData } from './editor-appearance';

  let {
    nodeId,
    data,
    expanded = false,
    onOpenStyles
  }: {
    nodeId: string;
    data: EditorAppearanceData;
    expanded?: boolean;
    onOpenStyles: () => void;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const initialNodeId = () => nodeId;
  const tracker = useNodeDataTracker(initialNodeId());
  const fontSizeTracker = tracker.track('fontSize', () => data.fontSize);
  const expandedFontSizeTracker = tracker.track('expandedFontSize', () => data.expandedFontSize);
  const activeFontSizeTracker = $derived(expanded ? expandedFontSizeTracker : fontSizeTracker);
  const fontSizeKey = $derived(expanded ? 'expandedFontSize' : 'fontSize');
  const fontSizeLabel = $derived(expanded ? 'Expanded font size' : 'Font size');
  const fontSizes = $derived(
    resolveEditorFontSizes(data, $editorFontSize, $editorFullscreenFontSize)
  );
  const fontFamilyTracker = tracker.track('fontFamily', () => data.fontFamily);
</script>

<label class="block">
  <span class="mb-1 block text-xs font-medium text-zinc-300">{fontSizeLabel}</span>
  <input
    type="number"
    min={expanded ? fontSizes.normal + 1 : 1}
    aria-label={fontSizeLabel}
    class="nodrag w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-zinc-500"
    value={expanded ? fontSizes.expanded : fontSizes.normal}
    onfocus={activeFontSizeTracker.onFocus}
    onblur={activeFontSizeTracker.onBlur}
    oninput={(event) => {
      const value = event.currentTarget.valueAsNumber;
      if (Number.isFinite(value) && value > 0) {
        const nextValue = expanded ? Math.max(fontSizes.normal + 1, value) : value;

        updateNodeData(nodeId, { [fontSizeKey]: nextValue });
      }
    }}
  />
</label>
<label class="block">
  <span class="mb-1 block text-xs font-medium text-zinc-300">Font family</span>
  <input
    type="text"
    aria-label="Font family"
    class="nodrag w-full min-w-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-300 outline-none focus:ring-1 focus:ring-zinc-500"
    value={data.fontFamily ?? $editorFontFamily}
    onfocus={fontFamilyTracker.onFocus}
    onblur={fontFamilyTracker.onBlur}
    oninput={(event) => updateNodeData(nodeId, { fontFamily: event.currentTarget.value })}
  />
</label>
<button
  class="w-full cursor-pointer rounded border border-zinc-600 px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-800"
  onclick={onOpenStyles}>Custom Styles…</button
>
