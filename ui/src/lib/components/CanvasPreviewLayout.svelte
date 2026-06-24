<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Activity } from '@lucide/svelte/icons';
  import ObjectPreviewLayout from './ObjectPreviewLayout.svelte';
  import * as Tooltip from './ui/tooltip';
  import type { SettingsSchema } from '$lib/settings';
  import type { ExtraMenuItem } from './object-preview-menu-actions';
  import { previewBackgroundColor } from '../../stores/renderer.store';
  import type { SupportedLanguage } from '$lib/codemirror/types';
  import type { RenderCookStatus } from '$lib/rendering/types';

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
    showCookDebugOption = false,
    cookDebugVisible = false,
    cookStatus = undefined,
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
    cookDebugVisible?: boolean;
    cookStatus?: RenderCookStatus;
    class?: string;
  } = $props();

  let showCookDebug = $state(cookDebugVisible);

  $effect(() => {
    showCookDebug = cookDebugVisible;
  });

  const cookStatusLabel = $derived(cookStatus?.status ?? 'cached');
  const cookReasons = $derived.by(() => {
    const visibleReasons = (cookStatus?.lastCookReasons ?? []).filter(
      (reason) => reason !== 'first-frame'
    );

    return visibleReasons.join(', ') || 'none';
  });
  const cookTime = $derived(
    cookStatus?.lastCookTimeMs == null ? '--' : `${cookStatus.lastCookTimeMs.toFixed(2)}ms`
  );
  const cookStatusClass = $derived.by(() => {
    if (cookStatusLabel === 'cooked') return 'text-emerald-300';
    if (cookStatusLabel === 'paused') return 'text-amber-300';

    return 'text-zinc-300';
  });

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

      {#if showCookDebugOption}
        <div class="absolute right-1 bottom-1 flex items-end gap-1">
          {#if showCookDebug}
            <div
              class="rounded border border-zinc-700/80 bg-zinc-950/90 px-2 py-1 font-mono text-[10px] leading-tight text-zinc-400 shadow"
            >
              <div class="flex gap-2">
                <span class={cookStatusClass}>{cookStatusLabel}</span>
                <span>{cookTime}</span>
              </div>
              <div class="max-w-48 truncate">reason: {cookReasons}</div>
              <div>{cookStatus?.cookedFrames ?? 0} cooks</div>
            </div>
          {/if}

          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                class={[
                  'cursor-pointer rounded border border-zinc-700/80 bg-zinc-950/80 p-1 shadow hover:bg-zinc-800',
                  showCookDebug ? 'text-emerald-300' : 'text-zinc-300'
                ]}
                aria-label={showCookDebug ? 'Hide cook debug' : 'Show cook debug'}
                onclick={() => (showCookDebug = !showCookDebug)}
              >
                <Activity class="h-3.5 w-3.5" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content
              >{showCookDebug ? 'Hide cook debug' : 'Show cook debug'}</Tooltip.Content
            >
          </Tooltip.Root>
        </div>
      {/if}
    </div>
  {/snippet}
</ObjectPreviewLayout>
