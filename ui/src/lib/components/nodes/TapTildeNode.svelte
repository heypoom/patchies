<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { Settings, X, RotateCcw } from '@lucide/svelte/icons';
  import { useEdges, useSvelteFlow, useUpdateNodeInternals } from '@xyflow/svelte';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import type { AudioNodeV2 } from '$lib/audio/v2/interfaces/audio-nodes';
  import TypedHandle from '$lib/components/TypedHandle.svelte';
  import TapSettings from '$lib/components/settings/TapSettings.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { checkAudioConnections } from '$lib/composables/checkHandleConnections';
  import { useNodeDataTracker } from '$lib/history';
  import { shouldShowHandles } from '../../../stores/ui.store';
  import { editorFontFamily } from '../../../stores/editor.store';

  type TapMode = 'wave' | 'xy';
  type TapNodeData = {
    mode?: TapMode;
    bufferSize?: number;
    fps?: number;
    zeroCrossing?: boolean;
  };

  const DEFAULTS = {
    mode: 'wave' as TapMode,
    bufferSize: 512,
    fps: 0,
    zeroCrossing: true
  };

  let node: {
    id: string;
    data: TapNodeData;
    selected: boolean;
  } = $props();

  const { updateNodeData, getEdges, deleteElements } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const edges = useEdges();
  const tracker = useNodeDataTracker(node.id);
  const audioService = AudioService.getInstance();

  let showSettings = $state(false);
  let tapNode: AudioNodeV2 | null = $state(null);
  let nodeButton: HTMLButtonElement | null = $state(null);
  let resizeObserver: ResizeObserver | null = null;
  let settingsOffset = $state(90);
  let mode = $state<TapMode>(node.data.mode ?? DEFAULTS.mode);
  let bufferSize = $state(node.data.bufferSize ?? DEFAULTS.bufferSize);
  let sampleDigitCount = $state(String(bufferSize).length);
  let fps = $state(node.data.fps ?? DEFAULTS.fps);
  let zeroCrossing = $state(node.data.zeroCrossing ?? DEFAULTS.zeroCrossing);

  const connections = $derived(checkAudioConnections(edges.current, node.id));
  const inletCount = $derived(mode === 'xy' ? 2 : 1);
  const containerClass = $derived(node.selected ? 'object-container-selected' : 'object-container');
  const HIDDEN_HANDLE_CLASS = 'opacity-30 group-hover:opacity-100 sm:opacity-0';
  const handleInletClass = $derived(
    node.selected || $shouldShowHandles || connections.hasInlet ? '' : HIDDEN_HANDLE_CLASS
  );

  function sendSetting(key: string, value: unknown) {
    tapNode?.send?.(key, value);
  }

  function updateSettingsOffset() {
    if (!nodeButton) return;

    settingsOffset = nodeButton.offsetWidth + 10;
  }

  function resetSampleDigitWidth() {
    sampleDigitCount = String(bufferSize).length;
  }

  function closeSettings() {
    showSettings = false;
    resetSampleDigitWidth();
  }

  function toggleSettings() {
    if (showSettings) {
      closeSettings();
    } else {
      showSettings = true;
    }
  }

  function applyAllSettings() {
    sendSetting('bufferSize', bufferSize);
    sendSetting('mode', mode);
    sendSetting('fps', fps);
    sendSetting('zeroCrossing', zeroCrossing);
  }

  function updateSettings(updates: Partial<TapNodeData>) {
    updateNodeData(node.id, updates);
  }

  function handleModeChange(value: TapMode) {
    const oldValue = mode;
    mode = value;
    updateSettings({ mode: value });
    sendSetting('mode', value);
    tracker.commit('mode', oldValue, value);
  }

  const bufferSizeTracker = tracker.track('bufferSize', () => node.data.bufferSize ?? 512);

  function handleBufferSizeChange(value: number) {
    bufferSize = value;
    updateSettings({ bufferSize: value });
    sendSetting('bufferSize', value);
  }

  const fpsTracker = tracker.track('fps', () => node.data.fps ?? 0);

  function handleFpsChange(value: number) {
    fps = value;
    updateSettings({ fps: value });
    sendSetting('fps', value);
  }

  function handleZeroCrossingChange(value: boolean) {
    const oldValue = zeroCrossing;
    zeroCrossing = value;
    updateSettings({ zeroCrossing: value });
    sendSetting('zeroCrossing', value);
    tracker.commit('zeroCrossing', oldValue, value);
  }

  function resetSettings() {
    const oldMode = mode;
    const oldZeroCrossing = zeroCrossing;

    mode = DEFAULTS.mode;
    bufferSize = DEFAULTS.bufferSize;
    fps = DEFAULTS.fps;
    zeroCrossing = DEFAULTS.zeroCrossing;

    updateSettings({ ...DEFAULTS });
    sendSetting('bufferSize', DEFAULTS.bufferSize);
    sendSetting('mode', DEFAULTS.mode);
    sendSetting('fps', DEFAULTS.fps);
    sendSetting('zeroCrossing', DEFAULTS.zeroCrossing);
    tracker.commit('mode', oldMode, mode);
    tracker.commit('zeroCrossing', oldZeroCrossing, zeroCrossing);
  }

  let prevInletCount: number | null = null;

  $effect(() => {
    const digits = String(bufferSize).length;

    if (digits > sampleDigitCount) {
      sampleDigitCount = digits;
    }
  });

  $effect(() => {
    const count = inletCount;
    updateNodeInternals(node.id);

    if (prevInletCount === null) {
      prevInletCount = count;
      return;
    }

    if (count < prevInletCount) {
      const staleEdges = getEdges().filter(
        (edge) => edge.target === node.id && edge.targetHandle === 'audio-in-1'
      );
      if (staleEdges.length > 0) {
        deleteElements({ edges: staleEdges });
      }
    }

    prevInletCount = count;
  });

  onMount(async () => {
    tapNode = await audioService.createNode(node.id, 'tap~', []);
    applyAllSettings();

    updateSettingsOffset();

    if (nodeButton && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateSettingsOffset);
      resizeObserver.observe(nodeButton);
    }
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    audioService.removeNodeById(node.id);
  });
</script>

<div class="relative flex gap-x-3" style:--patchies-tap-node-font-family={$editorFontFamily}>
  <div class="group relative">
    <div class="absolute -top-7 right-0 z-10 flex gap-x-1">
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            class={[
              'cursor-pointer rounded p-1 transition-opacity hover:bg-zinc-700',
              node.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            ]}
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              toggleSettings();
            }}
            aria-label="Configure tap"
          >
            <Settings class="h-4 w-4 text-zinc-300" />
          </button>
        </Tooltip.Trigger>

        <Tooltip.Content>Settings</Tooltip.Content>
      </Tooltip.Root>
    </div>

    <div class="relative">
      <TypedHandle
        port="inlet"
        spec={{ handleType: 'audio', handleId: '0' }}
        total={inletCount}
        index={0}
        title={mode === 'xy' ? 'X axis' : 'Audio input'}
        class={handleInletClass}
        nodeId={node.id}
      />

      {#if mode === 'xy'}
        <TypedHandle
          port="inlet"
          spec={{ handleType: 'audio', handleId: '1' }}
          total={inletCount}
          index={1}
          title="Y axis"
          class={handleInletClass}
          nodeId={node.id}
        />
      {/if}

      <button
        bind:this={nodeButton}
        class={['h-8.5 cursor-pointer rounded-lg border px-3 text-left', containerClass]}
      >
        <div
          class="tap-node-label inline-flex items-center gap-2 text-xs whitespace-nowrap text-zinc-300"
        >
          <span>tap~</span>

          <span class="tabular-nums" style:min-width={`${sampleDigitCount}ch`}>{bufferSize}</span>
        </div>
      </button>

      <TypedHandle
        port="outlet"
        spec={{ handleType: 'message', handleId: '0' }}
        total={1}
        index={0}
        title="Captured buffer output"
        nodeId={node.id}
      />
    </div>
  </div>

  {#if showSettings}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute z-20"
      style:left={`${settingsOffset}px`}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={resetSettings}
              class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
              aria-label="Reset tap settings"
            >
              <RotateCcw class="h-4 w-4" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>Reset</Tooltip.Content>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger>
            <button
              onclick={closeSettings}
              class="h-6 w-6 cursor-pointer rounded bg-zinc-950 p-1 text-zinc-300 hover:bg-zinc-700"
              aria-label="Close tap settings"
            >
              <X class="h-4 w-4" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>Close</Tooltip.Content>
        </Tooltip.Root>
      </div>

      <div class="nodrag w-48 rounded-md border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
        <TapSettings
          {mode}
          {bufferSize}
          {fps}
          {zeroCrossing}
          {bufferSizeTracker}
          {fpsTracker}
          onModeChange={handleModeChange}
          onBufferSizeChange={handleBufferSizeChange}
          onFpsChange={handleFpsChange}
          onZeroCrossingChange={handleZeroCrossingChange}
        />
      </div>
    </div>
  {/if}
</div>

<style>
  .tap-node-label {
    font-family: var(--patchies-tap-node-font-family, var(--font-mono));
  }
</style>
