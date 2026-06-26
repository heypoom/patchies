<script lang="ts">
  import { Settings, X } from '@lucide/svelte/icons';
  import { NodeResizer, useSvelteFlow } from '@xyflow/svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import {
    DEFAULT_GROUP_COLOR,
    GROUP_COLOR_PRESETS,
    GROUP_BORDER_HIT_ZONES,
    getGroupColorGridClasses,
    getGroupFrameStyle,
    getGroupSettingsPanelClasses,
    getGroupTitle,
    getGroupTitleClasses,
    getGroupVisualFrameClasses,
    getGroupVisualFrameStyle
  } from '$lib/canvas/group-hit-zones';
  import { DEFAULT_GROUP_HEIGHT, DEFAULT_GROUP_WIDTH } from '$lib/nodes/defaultNodeDimensions';
  import { useNodeDataTracker } from '$lib/history';
  import * as Tooltip from '$lib/components/ui/tooltip';

  let node: {
    id: string;
    data: {
      color?: string;
      title?: string;
    };
    selected: boolean;
    width?: number;
    height?: number;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const eventBus = PatchiesEventBus.getInstance();
  const tracker = useNodeDataTracker(node.id);
  const titleTracker = tracker.track('title', () => node.data.title ?? '');

  let showSettings = $state(false);

  const width = $derived(node.width ?? DEFAULT_GROUP_WIDTH);
  const height = $derived(node.height ?? DEFAULT_GROUP_HEIGHT);
  const color = $derived(node.data.color ?? DEFAULT_GROUP_COLOR);
  const title = $derived(getGroupTitle(node.data.title));
  const frameStyle = $derived(getGroupFrameStyle(width, height));
  const visualFrameClasses = $derived(getGroupVisualFrameClasses(node.selected));
  const visualFrameStyle = $derived(getGroupVisualFrameStyle(color, node.selected));

  function updateConfig(updates: Partial<typeof node.data>) {
    updateNodeData(node.id, { ...node.data, ...updates });
  }

  function toggleSettings(event: MouseEvent) {
    event.stopPropagation();
    showSettings = !showSettings;
  }

  function closeSettings(event: MouseEvent) {
    event.stopPropagation();
    showSettings = false;
  }

  function handleColorChange(nextColor: string) {
    const oldColor = color;
    updateConfig({ color: nextColor });
    tracker.commit('color', oldColor, nextColor);
  }

  function handleTitleInput(event: Event) {
    const nextTitle = (event.target as HTMLInputElement).value;
    updateConfig({ title: nextTitle });
  }

  function handleResizeEnd() {
    eventBus.dispatch({ type: 'visualGroupSyncRequested', groupId: node.id });
  }

  function handleResizeStart() {
    eventBus.dispatch({ type: 'visualGroupResizeStarted', groupId: node.id });
  }
</script>

<div class="pointer-events-none relative" style={frameStyle}>
  <NodeResizer
    class="pointer-events-auto z-1"
    isVisible={node.selected}
    minWidth={160}
    minHeight={120}
    keepAspectRatio={false}
    onResizeStart={handleResizeStart}
    onResizeEnd={handleResizeEnd}
  />

  <div class={getGroupTitleClasses()} aria-label="Select group">
    <div class="max-w-56 truncate font-mono text-xs font-medium text-zinc-400">{title}</div>
  </div>

  <div class="pointer-events-auto absolute -top-7 right-0 z-10 flex gap-x-1">
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          class={[
            'cursor-pointer rounded bg-zinc-900/80 p-1 transition-colors hover:bg-zinc-700',
            showSettings && 'bg-zinc-700'
          ]}
          onclick={toggleSettings}
          aria-label={showSettings ? 'Close group settings' : 'Open group settings'}
          aria-pressed={showSettings}
        >
          <Settings class="h-4 w-4 text-zinc-300" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content>{showSettings ? 'Close Settings' : 'Settings'}</Tooltip.Content>
    </Tooltip.Root>
  </div>

  <div class={visualFrameClasses} style={visualFrameStyle} aria-hidden="true"></div>

  {#each GROUP_BORDER_HIT_ZONES as zone (zone.id)}
    <div class={zone.className} aria-label={zone.ariaLabel}></div>
  {/each}

  {#if showSettings}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class={getGroupSettingsPanelClasses()} onclick={(event) => event.stopPropagation()}>
      <div class="mb-3 flex items-center justify-between gap-2">
        <div class="text-xs font-medium text-zinc-300">Group Settings</div>

        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              class="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              onclick={closeSettings}
              aria-label="Close group settings"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>Close</Tooltip.Content>
        </Tooltip.Root>
      </div>

      <label class="mb-3 block">
        <span class="mb-1 block text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
          Title
        </span>
        <input
          class="nodrag w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 transition-colors outline-none placeholder:text-zinc-600 focus:border-zinc-500"
          value={node.data.title ?? ''}
          placeholder="group"
          oninput={handleTitleInput}
          onfocus={titleTracker.onFocus}
          onblur={titleTracker.onBlur}
          aria-label="Group title"
        />
      </label>

      <div class="mb-2 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">Color</div>

      <div class={getGroupColorGridClasses()}>
        {#each GROUP_COLOR_PRESETS as preset (preset.name)}
          <Tooltip.Root>
            <Tooltip.Trigger>
              <button
                onclick={() => handleColorChange(preset.value)}
                class={[
                  'h-6 w-6 cursor-pointer rounded-full border-2 transition-all',
                  color === preset.value
                    ? 'scale-110 border-white shadow-md'
                    : 'border-zinc-700 hover:scale-105 hover:border-zinc-400'
                ]}
                style="background-color: {preset.value};"
                aria-label={preset.name}
              ></button>
            </Tooltip.Trigger>
            <Tooltip.Content>{preset.name}</Tooltip.Content>
          </Tooltip.Root>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.svelte-flow__node-group) {
    pointer-events: none !important;
    width: auto !important;
    height: auto !important;
    min-width: 0 !important;
    min-height: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    background: transparent !important;
    color: inherit !important;
    text-align: initial !important;
  }

  :global(.svelte-flow__node-group.selectable:hover),
  :global(.svelte-flow__node-group.selectable.selected),
  :global(.svelte-flow__node-group.selectable:focus),
  :global(.svelte-flow__node-group.selectable:focus-visible) {
    box-shadow: none !important;
  }
</style>
