<script lang="ts">
  import { Code, Play, Terminal, X } from '@lucide/svelte/icons';
  import { onMount, type Snippet } from 'svelte';
  import * as Tooltip from './ui/tooltip';
  import * as ContextMenu from './ui/context-menu';
  import ObjectPreviewOverflowMenu from './ObjectPreviewOverflowMenu.svelte';
  import ObjectPreviewContextMenu from './ObjectPreviewContextMenu.svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import ObjectSettings from '$lib/components/settings/ObjectSettings.svelte';
  import type { SettingsSchema } from '$lib/settings';
  import { transportStore } from '../../stores/transport.store';
  import { isSidebarOpen, sidebarView } from '../../stores/ui.store';
  import { helpViewStore } from '../../stores/help-view.store';
  import { overrideOutputNodeId } from '../../stores/renderer.store';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { useNodeSetPaused } from '$lib/canvas/use-node-set-paused.svelte';

  let previewContainer: HTMLDivElement | null = null;
  const { getNode, updateNodeData } = useSvelteFlow();

  let {
    title,
    nodeId,
    objectType,
    onrun,
    onPlaybackToggle,
    onPreviewToggle,
    paused = false,
    previewVisible = true,
    showPauseButton = false,
    showBgOutputOption = false,

    topHandle,
    bottomHandle,
    preview,
    previewWidth,
    codeEditor,
    console: consoleSnippet,
    editorReady,

    settingsSchema = undefined,
    settingsValues = {},
    onSettingsValueChange = undefined,
    onSettingsRevertAll = undefined
  }: {
    title: string;
    nodeId?: string;
    objectType?: string;
    onrun?: () => void;
    onPlaybackToggle?: () => void;
    onPreviewToggle?: () => void;
    paused?: boolean;
    previewVisible?: boolean;
    showPauseButton?: boolean;
    showBgOutputOption?: boolean;

    topHandle?: Snippet;
    bottomHandle?: Snippet;
    preview?: Snippet;
    codeEditor: Snippet;
    console?: Snippet;
    editorReady?: boolean;

    previewWidth?: number;

    settingsSchema?: SettingsSchema;
    settingsValues?: Record<string, unknown>;
    onSettingsValueChange?: (key: string, value: unknown) => void;
    onSettingsRevertAll?: () => void;
  } = $props();

  useNodeSetPaused(
    nodeId ?? '',
    () => paused,
    () => onPlaybackToggle?.()
  );

  const editorGap = 10;

  let showEditor = $state(false);
  let showSettings = $state(false);
  let previewContainerWidth = $state(0);

  function measureContainerWidth() {
    if (previewContainer) {
      previewContainerWidth = previewContainer.clientWidth;
    }
  }

  function handlePlaybackToggle() {
    onPlaybackToggle?.();
  }

  function handlePreviewToggle() {
    onPreviewToggle?.();
  }

  function handleOpenHelp() {
    const helpObject = objectType ?? title;
    helpViewStore.setLastViewed({ type: 'object', object: helpObject });
    sidebarView.set('help');
    isSidebarOpen.set(true);
  }

  function handleRun() {
    onrun?.();
    measureContainerWidth();
  }

  function handleConsoleToggle() {
    if (nodeId) {
      const node = getNode(nodeId);
      if (node) {
        const newShowConsole = !node.data.showConsole;
        updateNodeData(nodeId, { ...node.data, showConsole: newShowConsole });
      }
    }
  }

  let resizeObserver: ResizeObserver | null = null;

  onMount(() => {
    // Use ResizeObserver to re-measure width when container size changes
    if (previewWidth === undefined && previewContainer) {
      resizeObserver = new ResizeObserver(() => {
        measureContainerWidth();
      });

      resizeObserver.observe(previewContainer);
    }

    return () => {
      resizeObserver?.disconnect();
    };
  });

  let editorLeftPos = $derived.by(() => {
    return (previewWidth ?? previewContainerWidth) + editorGap;
  });

  let canPin = $derived($transportStore.isPlaying);

  let isOutputOverride = $derived(
    showBgOutputOption && nodeId !== undefined && $overrideOutputNodeId === nodeId
  );

  function handleBgOutputToggle() {
    if (!nodeId) return;
    const next = isOutputOverride ? null : nodeId;
    overrideOutputNodeId.set(next);
    GLSystem.getInstance().setOverrideOutputNode(next);
  }
</script>

<div class="relative flex gap-x-3">
  <ContextMenu.Root>
    <ContextMenu.Trigger>
      <div class="group relative">
        <div class="flex flex-col gap-2">
          <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
            <div class="z-10 rounded-lg bg-black/60 px-2 py-1">
              <div class="font-mono text-xs font-medium text-zinc-400">{title}</div>
            </div>

            <div class="flex gap-1">
              <ObjectPreviewOverflowMenu
                onrun={onrun ? handleRun : undefined}
                {settingsSchema}
                {showSettings}
                {showBgOutputOption}
                {nodeId}
                {isOutputOverride}
                {showPauseButton}
                {paused}
                {canPin}
                onPreviewToggle={onPreviewToggle ? handlePreviewToggle : undefined}
                {previewVisible}
                onSettingsToggle={() => {
                  showSettings = !showSettings;
                  if (showSettings) showEditor = false;
                }}
                onBgOutputToggle={handleBgOutputToggle}
                onPlaybackToggle={handlePlaybackToggle}
                onOpenHelp={handleOpenHelp}
              />

              <Tooltip.Root>
                <Tooltip.Trigger>
                  <button
                    class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
                    onclick={() => {
                      showEditor = !showEditor;
                      if (showEditor) showSettings = false;
                      measureContainerWidth();
                    }}
                  >
                    <Code class="h-4 w-4 text-zinc-300" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content>Edit Code</Tooltip.Content>
              </Tooltip.Root>
            </div>
          </div>

          <div class="relative">
            {@render topHandle?.()}
            <div bind:this={previewContainer}>{@render preview?.()}</div>
            {@render bottomHandle?.()}
          </div>
        </div>
      </div>
    </ContextMenu.Trigger>

    <ObjectPreviewContextMenu
      onrun={onrun ? handleRun : undefined}
      {showBgOutputOption}
      {nodeId}
      {isOutputOverride}
      {showPauseButton}
      {canPin}
      {paused}
      onPreviewToggle={onPreviewToggle ? handlePreviewToggle : undefined}
      {previewVisible}
      {settingsSchema}
      {showSettings}
      onSettingsToggle={() => {
        showSettings = !showSettings;
        if (showSettings) showEditor = false;
      }}
      onBgOutputToggle={handleBgOutputToggle}
      onPlaybackToggle={handlePlaybackToggle}
      onOpenHelp={handleOpenHelp}
    />
  </ContextMenu.Root>

  {#if showSettings && settingsSchema && settingsSchema.length > 0 && nodeId}
    <div class="absolute top-0" style="left: {editorLeftPos}px;">
      <ObjectSettings
        {nodeId}
        schema={settingsSchema}
        values={settingsValues}
        onValueChange={(key, value) => onSettingsValueChange?.(key, value)}
        onRevertAll={() => onSettingsRevertAll?.()}
        onClose={() => (showSettings = false)}
      />
    </div>
  {/if}

  {#if showEditor}
    <div class="absolute" style="left: {editorLeftPos}px;">
      {#if editorReady !== false}
        <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
          {#if onrun}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button onclick={handleRun} class="cursor-pointer rounded p-1 hover:bg-zinc-700">
                  <Play class="h-4 w-4 text-zinc-300" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>
                <p>Run Code (shift+enter)</p>
              </Tooltip.Content>
            </Tooltip.Root>
          {/if}

          {#if consoleSnippet}
            <Tooltip.Root>
              <Tooltip.Trigger>
                <button
                  class="cursor-pointer rounded p-1 hover:bg-zinc-700"
                  onclick={handleConsoleToggle}
                >
                  <Terminal class="h-4 w-4 text-zinc-300" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>Toggle Console</Tooltip.Content>
            </Tooltip.Root>
          {/if}

          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                onclick={() => (showEditor = false)}
                class="cursor-pointer rounded p-1 hover:bg-zinc-700"
              >
                <X class="h-4 w-4 text-zinc-300" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content>Close Editor</Tooltip.Content>
          </Tooltip.Root>
        </div>
      {/if}

      <div class="rounded-lg border border-zinc-600 bg-zinc-900 shadow-xl">
        <div class="flex flex-col">
          {@render codeEditor()}
        </div>
      </div>

      {#if consoleSnippet}
        {@render consoleSnippet()}
      {/if}
    </div>
  {/if}
</div>
