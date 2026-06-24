<script lang="ts">
  import type { Snippet } from 'svelte';
  import CookDebugOverlay from './CookDebugOverlay.svelte';
  import ObjectPreviewLayout from './ObjectPreviewLayout.svelte';
  import type { SettingsSchema } from '$lib/settings';
  import type { ExtraMenuItem } from './object-preview-menu-actions';
  import { previewBackgroundColor, showCookStats } from '../../stores/renderer.store';
  import type { SupportedLanguage } from '$lib/codemirror/types';
  import { useCookStatus } from '$lib/canvas/use-cook-status.svelte';

  const COOK_DEBUG_OBJECT_TYPES = new Set(['glsl', 'hydra']);

  let {
    title,
    nodeId,
    objectType,
    selected = false,
    hasError = false,
    onrun,
    onPlaybackToggle,
    onPreviewToggle,
    paused = false,
    previewVisible = true,
    showPauseButton = false,
    previewCanvas = $bindable<HTMLCanvasElement>(),
    nodrag = false,
    nopan = false,
    nowheel = false,
    tabindex,

    width,
    height,
    style = '',
    pixelated = false,

    topHandle,
    bottomHandle,

    codeEditor,
    console: consoleSnippet,
    editorReady,
    codeDataKey = 'code',
    codeLanguage = 'javascript',
    codePlaceholder = '',
    onCodeChange = undefined,

    settingsSchema = undefined,
    settingsValues = {},
    onSettingsValueChange = undefined,
    onSettingsRevertAll = undefined,
    extraMenuItems = undefined,
    displayExtraMenuItems = undefined,
    showBgOutputOption = true,
    showExpandOption = true,
    showCookDebugOption = undefined,
    class: className = ''
  }: {
    title: string;
    nodeId?: string;
    objectType?: string;
    selected?: boolean;
    hasError?: boolean;
    onrun?: (code?: string) => void;
    onPlaybackToggle?: () => void;
    onPreviewToggle?: () => void;
    paused?: boolean;
    previewVisible?: boolean;
    showPauseButton?: boolean;
    previewCanvas?: HTMLCanvasElement;
    nodrag?: boolean;
    nopan?: boolean;
    nowheel?: boolean;
    tabindex?: number;

    width?: string | number;
    height?: string | number;
    style?: string;
    pixelated?: boolean;

    topHandle?: Snippet;
    bottomHandle?: Snippet;

    codeEditor: Snippet;
    console?: Snippet;
    editorReady?: boolean;
    codeDataKey?: string;
    codeLanguage?: SupportedLanguage;
    codePlaceholder?: string;
    onCodeChange?: (value: string) => void;

    settingsSchema?: SettingsSchema;
    settingsValues?: Record<string, unknown>;
    onSettingsValueChange?: (key: string, value: unknown) => void;
    onSettingsRevertAll?: () => void;
    extraMenuItems?: ExtraMenuItem[];
    displayExtraMenuItems?: ExtraMenuItem[];
    showBgOutputOption?: boolean;
    showExpandOption?: boolean;
    showCookDebugOption?: boolean;
    class?: string;
  } = $props();

  const cookDebugSupported = $derived(
    showCookDebugOption ?? Boolean(objectType && COOK_DEBUG_OBJECT_TYPES.has(objectType))
  );

  const cookStatus = useCookStatus(
    () => nodeId,
    () => cookDebugSupported && $showCookStats
  );

  // Build the interaction class string based on individual flags
  const interactionClass = $derived.by(() => {
    if (!nodrag && !nopan && !nowheel) return 'cursor-move';

    const classes: string[] = ['cursor-default'];

    if (nodrag) classes.push('nodrag');
    if (nopan) classes.push('nopan');
    if (nowheel) classes.push('nowheel');

    return classes.join(' ');
  });
</script>

<ObjectPreviewLayout
  {title}
  {nodeId}
  {objectType}
  {onrun}
  {onPlaybackToggle}
  {onPreviewToggle}
  {paused}
  {previewVisible}
  {showPauseButton}
  {showBgOutputOption}
  {showExpandOption}
  {topHandle}
  {bottomHandle}
  {codeEditor}
  {editorReady}
  {codeDataKey}
  {codeLanguage}
  {codePlaceholder}
  {onCodeChange}
  console={consoleSnippet}
  {settingsSchema}
  {settingsValues}
  {onSettingsValueChange}
  {onSettingsRevertAll}
  {extraMenuItems}
  {displayExtraMenuItems}
  class={className}
>
  {#snippet preview()}
    <div class="relative">
      <canvas
        bind:this={previewCanvas}
        class={[
          'rounded-md border',
          hasError
            ? 'border-red-500/70'
            : selected
              ? 'shadow-glow-md border-zinc-300 [&>canvas]:rounded-[7px]'
              : 'hover:shadow-glow-sm border-zinc-400 [&>canvas]:rounded-md',
          interactionClass
        ]}
        {tabindex}
        width={typeof width === 'number' ? width : undefined}
        height={typeof height === 'number' ? height : undefined}
        style={typeof width === 'number' && typeof height === 'number'
          ? `width:${width}px;height:${height}px;background-color:${$previewBackgroundColor};${pixelated ? 'image-rendering:pixelated;' : ''}${style}`
          : `background-color:${$previewBackgroundColor};${pixelated ? 'image-rendering:pixelated;' : ''}${style}`}
      ></canvas>

      <CookDebugOverlay
        enabled={cookDebugSupported && $showCookStats}
        visible={$showCookStats}
        cookStatus={cookStatus.status}
      />
    </div>
  {/snippet}
</ObjectPreviewLayout>
