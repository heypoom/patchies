<script lang="ts">
  import {
    CircleHelp,
    Code,
    Ellipsis,
    Eye,
    EyeOff,
    Pin,
    PinOff,
    Play,
    X,
    Terminal
  } from '@lucide/svelte/icons';
  import { onMount, type Snippet } from 'svelte';
  import * as Tooltip from './ui/tooltip';
  import * as Popover from './ui/popover';
  import * as ContextMenu from './ui/context-menu';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { transportStore } from '../../stores/transport.store';
  import { isSidebarOpen, sidebarView } from '../../stores/ui.store';
  import { helpViewStore } from '../../stores/help-view.store';

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

    topHandle,
    bottomHandle,
    preview,
    previewWidth,
    codeEditor,
    console: consoleSnippet,
    editorReady
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

    topHandle?: Snippet;
    bottomHandle?: Snippet;
    preview?: Snippet;
    codeEditor: Snippet;
    console?: Snippet;
    editorReady?: boolean;

    previewWidth?: number;
  } = $props();

  const editorGap = 10;

  let showEditor = $state(false);
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
      <ContextMenu.Item onclick={handleOpenHelp}>
        <CircleHelp class="mr-2 h-4 w-4" />
        Help
      </ContextMenu.Item>
    </ContextMenu.Content>
  </ContextMenu.Root>

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
