<script lang="ts">
  import SettingRow from '../SettingRow.svelte';
  import SettingDropdown from '../SettingDropdown.svelte';
  import NativeColorPicker from '$lib/components/settings/NativeColorPicker.svelte';
  import {
    edgeOpacity,
    nodeOpacity,
    setEdgeOpacity,
    setNodeOpacity
  } from '../../../../stores/appearance-settings.store';
  import {
    editorFullscreenTextBackgroundOpacity,
    setEditorFullscreenTextBackgroundOpacity
  } from '../../../../stores/editor.store';
  import {
    overlayEditorTransparency,
    setOverlayEditorTransparency
  } from '../../../../stores/editor-layout-settings.store';
  import { previewBackgroundColor } from '../../../../stores/renderer.store';
  import {
    DEFAULT_PREVIEW_BACKGROUND_COLOR,
    type PreviewBackgroundColor
  } from '$lib/rendering/preview-background';
  import { match } from 'ts-pattern';

  const previewBackgroundModeOptions = [
    { value: 'transparent', label: 'Transparent' },
    { value: 'color', label: 'Color' }
  ];

  const previewBackgroundMode = $derived(
    match($previewBackgroundColor)
      .with('transparent', () => 'transparent')
      .otherwise(() => 'color')
  );

  function getCustomPreviewBackgroundColor(color: PreviewBackgroundColor): `#${string}` {
    return match(color)
      .with('transparent', () => DEFAULT_PREVIEW_BACKGROUND_COLOR as `#${string}`)
      .otherwise((hex) => hex as `#${string}`);
  }

  let customPreviewBackgroundColor = $state<`#${string}`>(
    getCustomPreviewBackgroundColor($previewBackgroundColor)
  );

  $effect(() => {
    match($previewBackgroundColor)
      .with('transparent', () => {})
      .otherwise((color) => {
        customPreviewBackgroundColor = color as `#${string}`;
      });
  });

  function handleNodeOpacityInput(event: Event) {
    setNodeOpacity(Number((event.target as HTMLInputElement).value));
  }

  function handleEdgeOpacityInput(event: Event) {
    setEdgeOpacity(Number((event.target as HTMLInputElement).value));
  }

  const overlayTransparencyPercent = $derived(Math.round($overlayEditorTransparency * 100));

  function handleFullscreenTextBackgroundOpacityInput(event: Event) {
    setEditorFullscreenTextBackgroundOpacity(Number((event.target as HTMLInputElement).value));
  }

  function handleOverlayTransparencyInput(event: Event) {
    setOverlayEditorTransparency(Number((event.target as HTMLInputElement).value) / 100);
  }

  function handlePreviewBackgroundModeChange(value: string) {
    match(value)
      .with('transparent', () => previewBackgroundColor.set('transparent'))
      .otherwise(() => previewBackgroundColor.set(customPreviewBackgroundColor));
  }

  function handlePreviewBackgroundColorInput(value: string) {
    const color = value as `#${string}`;

    customPreviewBackgroundColor = color;
    previewBackgroundColor.set(color);
  }
</script>

<SettingRow title="Node opacity" description="Dim all nodes without changing the patch.">
  <div class="flex items-center gap-3">
    <input
      type="range"
      min="0"
      max="100"
      step="5"
      value={$nodeOpacity}
      oninput={handleNodeOpacityInput}
      class="h-1.5 w-28 cursor-pointer accent-zinc-500"
      aria-label="Node opacity"
    />
    <span class="w-9 text-right font-mono text-xs text-zinc-400">{$nodeOpacity}%</span>
  </div>
</SettingRow>

<SettingRow
  title="Edge opacity"
  description="Dim connection cables for a cleaner performance canvas."
>
  <div class="flex items-center gap-3">
    <input
      type="range"
      min="0"
      max="100"
      step="5"
      value={$edgeOpacity}
      oninput={handleEdgeOpacityInput}
      class="h-1.5 w-28 cursor-pointer accent-zinc-500"
      aria-label="Edge opacity"
    />
    <span class="w-9 text-right font-mono text-xs text-zinc-400">{$edgeOpacity}%</span>
  </div>
</SettingRow>

<SettingRow title="Preview background" description="Composite node previews over a color.">
  <div class="flex items-center gap-2">
    <SettingDropdown
      value={previewBackgroundMode}
      options={previewBackgroundModeOptions}
      onchange={handlePreviewBackgroundModeChange}
      label="Preview background"
    />

    {#if previewBackgroundMode === 'color'}
      <NativeColorPicker
        value={customPreviewBackgroundColor}
        class="h-7 w-9 cursor-pointer rounded border border-white/10 bg-white/5 p-0.5"
        swatchClass="block h-full w-full rounded-sm"
        ariaLabel="Preview background color"
        onInput={handlePreviewBackgroundColorInput}
      />
    {/if}
  </div>
</SettingRow>

<SettingRow
  title="Text background overlay opacity"
  description="Add a dark background behind text in the expanded editor for more contrast."
>
  <div class="flex items-center gap-3">
    <input
      type="range"
      min="0"
      max="100"
      step="5"
      value={$editorFullscreenTextBackgroundOpacity}
      oninput={handleFullscreenTextBackgroundOpacityInput}
      class="h-1.5 w-28 cursor-pointer accent-zinc-500"
      aria-label="Text background overlay opacity"
    />

    <span class="w-9 text-right font-mono text-xs text-zinc-400"
      >{$editorFullscreenTextBackgroundOpacity}%</span
    >
  </div>
</SettingRow>

<SettingRow
  title="Overlay transparency"
  description="Adjust the Zen editor panel background opacity."
>
  <div class="flex items-center gap-3">
    <input
      type="range"
      min="0"
      max="100"
      step="5"
      value={overlayTransparencyPercent}
      oninput={handleOverlayTransparencyInput}
      class="h-1.5 w-28 cursor-pointer accent-zinc-500"
      aria-label="Overlay editor transparency"
    />
    <span class="w-9 text-right font-mono text-xs text-zinc-400">{overlayTransparencyPercent}%</span
    >
  </div>
</SettingRow>
