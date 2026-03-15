<script lang="ts">
  import {
    CircleHelp,
    Code,
    Ellipsis,
    Eye,
    EyeOff,
    Monitor,
    MonitorOff,
    Pin,
    PinOff,
    Play,
    Settings,
    X,
    Terminal
  } from '@lucide/svelte/icons';
  import { onMount, type Snippet } from 'svelte';
  import * as Tooltip from './ui/tooltip';
  import * as Popover from './ui/popover';
  import * as ContextMenu from './ui/context-menu';
  import { useSvelteFlow } from '@xyflow/svelte';
  import ObjectSettings from '$lib/components/settings/ObjectSettings.svelte';
  import type { SettingsSchema } from '$lib/settings';
  import { transportStore } from '../../stores/transport.store';
  import { isSidebarOpen, sidebarView } from '../../stores/ui.store';
  import { helpViewStore } from '../../stores/help-view.store';
  import { overrideOutputNodeId } from '../../stores/renderer.store';
  import { GLSystem } from '$lib/canvas/GLSystem';

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
    showConsoleButton = false,
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
    showConsoleButton?: boolean;
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
              <Popover.Root>
                <Popover.Trigger>
                  <button
                    class="cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Ellipsis class="h-4 w-4 text-zinc-300" />
                  </button>
                </Popover.Trigger>
                <Popover.Content class="flex w-auto flex-col p-1" align="end" sideOffset={4}>
                  {#if onrun}
                    <Popover.Close class="contents">
                      <button
                        class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700"
                        onclick={handleRun}
                      >
                        <Play class="h-4 w-4 text-zinc-300" />
                        <span>Run</span>
                      </button>
                    </Popover.Close>
                  {/if}

                  {#if settingsSchema && settingsSchema.length > 0}
                    <Popover.Close class="contents">
                      <button
                        class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700"
                        onclick={() => {
                          showSettings = !showSettings;
                          if (showSettings) showEditor = false;
                        }}
                      >
                        <Settings class="h-4 w-4 text-zinc-300" />
                        <span>Settings</span>
                      </button>
                    </Popover.Close>
                  {/if}

                  {#if showBgOutputOption && nodeId !== undefined}
                    <Popover.Close class="contents">
                      <button
                        class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700"
                        onclick={handleBgOutputToggle}
                      >
                        {#if isOutputOverride}
                          <MonitorOff class="h-4 w-4 text-orange-400" />
                          <span>Remove background output</span>
                        {:else}
                          <Monitor class="h-4 w-4 text-zinc-300" />
                          <span>Output to background</span>
                        {/if}
                      </button>
                    </Popover.Close>
                  {/if}

                  {#if showPauseButton}
                    <Popover.Close class="contents">
                      <button
                        class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                        onclick={handlePlaybackToggle}
                        disabled={!canPin && !paused}
                      >
                        {#if paused}
                          <PinOff class="h-4 w-4 text-red-400" />
                          <span>Unfreeze frame</span>
                        {:else}
                          <Pin class="h-4 w-4 text-zinc-300" />
                          <span>Freeze frame</span>
                        {/if}
                      </button>
                    </Popover.Close>
                  {/if}

                  {#if onPreviewToggle}
                    <Popover.Close class="contents">
                      <button
                        class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700"
                        onclick={handlePreviewToggle}
                      >
                        {#if previewVisible}
                          <EyeOff class="h-4 w-4 text-zinc-300" />
                          <span>Hide preview</span>
                        {:else}
                          <Eye class="h-4 w-4 text-zinc-300" />
                          <span>Show preview</span>
                        {/if}
                      </button>
                    </Popover.Close>
                  {/if}

                  <Popover.Close class="contents">
                    <button
                      class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-zinc-700"
                      onclick={handleOpenHelp}
                    >
                      <CircleHelp class="h-4 w-4 text-zinc-300" />
                      <span>Help</span>
                    </button>
                  </Popover.Close>
                </Popover.Content>
              </Popover.Root>

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

    <ContextMenu.Content>
      {#if onrun}
        <ContextMenu.Item onclick={handleRun}>
          <Play class="mr-2 h-4 w-4" />
          Run
        </ContextMenu.Item>

        <ContextMenu.Separator />
      {/if}

      {#if showBgOutputOption && nodeId !== undefined}
        <ContextMenu.Item onclick={handleBgOutputToggle}>
          {#if isOutputOverride}
            <MonitorOff class="mr-2 h-4 w-4 text-orange-400" />
            Remove background output
          {:else}
            <Monitor class="mr-2 h-4 w-4" />
            Output to background
          {/if}
        </ContextMenu.Item>
        <ContextMenu.Separator />
      {/if}
      {#if showPauseButton}
        <ContextMenu.Item onclick={handlePlaybackToggle} disabled={!canPin && !paused}>
          {#if paused}
            <PinOff class="mr-2 h-4 w-4 text-red-400" />
            Unfreeze frame
          {:else}
            <Pin class="mr-2 h-4 w-4" />
            Freeze frame
          {/if}
        </ContextMenu.Item>
      {/if}
      {#if onPreviewToggle}
        <ContextMenu.Item onclick={handlePreviewToggle}>
          {#if previewVisible}
            <EyeOff class="mr-2 h-4 w-4" />
            Hide preview
          {:else}
            <Eye class="mr-2 h-4 w-4" />
            Show preview
          {/if}
        </ContextMenu.Item>
      {/if}
      {#if showPauseButton || onPreviewToggle}
        <ContextMenu.Separator />
      {/if}
      {#if settingsSchema && settingsSchema.length > 0}
        <ContextMenu.Item
          onclick={() => {
            showSettings = !showSettings;
            if (showSettings) showEditor = false;
          }}
        >
          <Settings class="mr-2 h-4 w-4" />
          Settings
        </ContextMenu.Item>
        <ContextMenu.Separator />
      {/if}
      <ContextMenu.Item onclick={handleOpenHelp}>
        <CircleHelp class="mr-2 h-4 w-4" />
        Help
      </ContextMenu.Item>
    </ContextMenu.Content>
  </ContextMenu.Root>

  {#if showSettings && settingsSchema && settingsSchema.length > 0}
    <div class="absolute top-0" style="left: {editorLeftPos}px;">
      <ObjectSettings
        nodeId={nodeId ?? ''}
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
                <button onclick={handleRun} class="rounded p-1 hover:bg-zinc-700">
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
                <button class="rounded p-1 hover:bg-zinc-700" onclick={handleConsoleToggle}>
                  <Terminal class="h-4 w-4 text-zinc-300" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Content>Toggle Console</Tooltip.Content>
            </Tooltip.Root>
          {/if}

          <Tooltip.Root>
            <Tooltip.Trigger>
              <button onclick={() => (showEditor = false)} class="rounded p-1 hover:bg-zinc-700">
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
