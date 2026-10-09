<script lang="ts">
  import { Code, Ellipsis, Expand, Lock, Maximize2, MoveUpRight, X } from '@lucide/svelte/icons';
  import { NodeResizer, useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { tick, type Snippet } from 'svelte';
  import { useNodeDataTracker } from '$lib/history';
  import * as Popover from '$lib/components/ui/popover';
  import CodeBlockActionButton from '$lib/components/CodeBlockActionButton.svelte';
  import { openEditorLayout } from '$lib/code-editor/open-editor-layout';
  import { defaultEditorLayout } from '../../stores/editor-layout-settings.store';
  import {
    boundMusicCodeSize,
    DEFAULT_MUSIC_CODE_SIZE,
    type MusicCodeLayoutData,
    type MusicCodeSize
  } from './music-code-layout';

  let {
    nodeId,
    data,
    label,
    selected = false,
    expanded = false,
    hasError = false,
    status,
    viewportStyle,
    actions,
    controls,
    editorControls,
    menu,
    handles,
    outlets,
    sidePanel,
    children,
    onExpand,
    onOpenSidebar,
    onInspect
  }: {
    nodeId: string;
    data: MusicCodeLayoutData;
    label: string;
    selected?: boolean;
    expanded?: boolean;
    hasError?: boolean;
    status?: string;
    viewportStyle?: string;
    actions?: Snippet;
    controls?: Snippet;
    editorControls?: Snippet;
    menu?: Snippet;
    handles?: Snippet;
    outlets?: Snippet;
    sidePanel?: Snippet;
    children: Snippet;
    onExpand: () => void;
    onOpenSidebar?: () => void;
    onInspect?: () => void;
  } = $props();

  const { updateNodeData, updateNode } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const getInitialNodeId = () => nodeId;
  const tracker = useNodeDataTracker(getInitialNodeId());

  let inspecting = $state(false);
  let menuOpen = $state(false);
  let inspectionMenuOpen = $state(false);
  let oldSize: MusicCodeSize | undefined;

  const collapsed = $derived(data.editorCollapsed ?? false);
  const resizingEnabled = $derived(data.editorResizingEnabled ?? true);
  const size = $derived(boundMusicCodeSize(data.editorSize ?? DEFAULT_MUSIC_CODE_SIZE));
  const showEditor = $derived(!collapsed || inspecting);
  const borderColor = $derived.by(() => {
    if (hasError) return 'border-red-500';

    return 'border-zinc-700';
  });

  function setCollapsed(value: boolean) {
    const oldValue = data.editorCollapsed;

    updateNodeData(nodeId, { editorCollapsed: value });
    tracker.commit('editorCollapsed', oldValue, value);
    inspecting = false;
    menuOpen = false;
    inspectionMenuOpen = false;
  }

  export const closeInspection = () => (inspecting = false);

  export const setEditorCollapsed = (value: boolean) => setCollapsed(value);

  function toggleResizing() {
    const oldValue = data.editorResizingEnabled;
    const nextValue = !resizingEnabled;

    updateNodeData(nodeId, { editorResizingEnabled: nextValue });
    tracker.commit('editorResizingEnabled', oldValue, nextValue);
    menuOpen = false;
  }

  function openCode(event: MouseEvent) {
    onInspect?.();

    openEditorLayout({
      defaultLayout: $defaultEditorLayout,
      useAlternateLayout: event.shiftKey,
      openInline: () => (inspecting = true),
      toggleInline: () => (inspecting = !inspecting),
      openOverlay: () => {
        inspecting = false;
        onExpand();
      },
      openSidebar: () => {
        inspecting = false;
        (onOpenSidebar ?? onExpand)();
      }
    });
  }

  function resize(_event: unknown, dimensions: MusicCodeSize) {
    updateNodeData(nodeId, {
      editorSize: boundMusicCodeSize({
        width: dimensions.width,
        height: dimensions.height - 2
      })
    });
  }

  function finishResize() {
    if (oldSize?.width === data.editorSize?.width && oldSize?.height === data.editorSize?.height) {
      return;
    }

    tracker.commit('editorSize', oldSize, data.editorSize);
  }

  // NodeResizer owns outer dimensions. Keep them in sync after collapse and undo.
  $effect(() => {
    updateNode(nodeId, {
      width: collapsed ? 100 : size.width,
      height: collapsed ? 42 : size.height + 2
    });

    void tick().then(() => updateNodeInternals(nodeId));
  });
</script>

<div
  class="music-code-container group relative text-zinc-200"
  style:width={collapsed ? '100px' : `${size.width}px`}
>
  {#if !collapsed && !expanded}
    <NodeResizer
      {nodeId}
      isVisible={selected && resizingEnabled}
      minWidth={320}
      minHeight={122}
      onResizeStart={() => (oldSize = data.editorSize)}
      onResize={resize}
      onResizeEnd={finishResize}
    />
  {/if}

  {@render handles?.()}

  {#snippet layoutControls()}
    <Popover.Root bind:open={menuOpen}>
      <Popover.Trigger
        class="cursor-pointer rounded p-1 hover:bg-zinc-700"
        aria-label="Editor options"><Ellipsis class="h-4 w-4" /></Popover.Trigger
      >
      <Popover.Content
        class="nodrag nopan w-52 p-1"
        side="right"
        align="start"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {@render menu?.()}
        <button
          class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-700"
          onclick={() => {
            menuOpen = false;
            onExpand();
          }}><Expand class="h-4 w-4" />Expand Editor</button
        >
        <button
          class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-700"
          onclick={() => setCollapsed(!collapsed)}
          ><Code class="h-4 w-4" />{collapsed ? 'Show Editor in Patch' : 'Hide Code'}</button
        >
        <button
          class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-700"
          onclick={toggleResizing}
        >
          {#if resizingEnabled}<Lock class="h-4 w-4" />{:else}<Maximize2 class="h-4 w-4" />{/if}
          {resizingEnabled ? 'Disable Resizing' : 'Enable Resizing'}
        </button>
      </Popover.Content>
    </Popover.Root>
  {/snippet}

  <div class="absolute -top-7 left-0 z-20 flex w-full items-center justify-between gap-1">
    <div
      title={status}
      class="node-title-drag-handle rounded-lg bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-400"
    >
      {label}
    </div>
    <div class="nodrag nopan flex items-center gap-1">
      {#if !collapsed}{@render actions?.()}{/if}
      {#if controls}
        {#if !expanded}{@render controls()}{/if}
      {:else}
        {@render layoutControls()}
      {/if}
    </div>
  </div>

  {#if collapsed}
    <CodeBlockActionButton
      action="code"
      large
      {selected}
      {borderColor}
      minWidth={100}
      isRunning={false}
      showRunningIndicator={false}
      isLongRunningTaskActive={false}
      onRun={() => {}}
      onCode={openCode}
      onSettings={() => {}}
    />
  {/if}

  <div
    class={[
      'music-code-viewport nodrag nopan min-h-0 min-w-0 rounded-md border bg-zinc-900',
      borderColor,
      !showEditor && 'hidden',
      collapsed ? 'absolute top-0 left-full ml-3' : 'relative'
    ]}
    style={viewportStyle}
    style:width={collapsed ? `${size.width}px` : '100%'}
    style:height={`${size.height + 2}px`}
  >
    {#if collapsed && inspecting && !expanded}
      <div class="absolute -top-7 left-0 flex w-full items-center justify-end">
        <div class="flex items-center gap-1">
          {@render actions?.()}
          {@render editorControls?.()}
          <Popover.Root bind:open={inspectionMenuOpen}>
            <Popover.Trigger
              class="cursor-pointer rounded p-1 hover:bg-zinc-700"
              aria-label="Floating editor options"><Ellipsis class="h-4 w-4" /></Popover.Trigger
            >
            <Popover.Content
              class="nodrag nopan nowheel w-52 p-1"
              align="end"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <button
                class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-700"
                onclick={() => setCollapsed(false)}
                ><MoveUpRight class="h-4 w-4" />Keep Editor in Patch</button
              >
              <button
                class="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-700"
                onclick={() => {
                  inspectionMenuOpen = false;
                  onExpand();
                }}><Expand class="h-4 w-4" />Expand Editor</button
              >
            </Popover.Content>
          </Popover.Root>
          <button
            class="cursor-pointer rounded p-1 hover:bg-zinc-700"
            onclick={() => (inspecting = false)}
            aria-label="Close code inspection"><X class="h-4 w-4" /></button
          >
        </div>
      </div>
    {/if}
    <div class="music-code-body h-full min-h-0 min-w-0 overflow-hidden">
      {@render children()}
    </div>
  </div>

  {@render outlets?.()}
  {#if sidePanel}
    <div
      class="absolute top-0 left-full"
      style:margin-left={`${collapsed && inspecting ? size.width + 24 : 12}px`}
    >
      {@render sidePanel()}
    </div>
  {/if}
</div>

<style>
  .music-code-body :global(.cm-editor) {
    height: 100%;
    border: none;
  }

  .music-code-body :global(.cm-editor.cm-focused) {
    outline: none;
    box-shadow: none;
  }

  .music-code-body :global(.cm-scroller) {
    overflow: auto;
  }
</style>
