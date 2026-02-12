<script lang="ts">
  import { Settings, X, Mic } from '@lucide/svelte/icons';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { MicNode, DEFAULT_MIC_SETTINGS, type MicSettings } from '$lib/audio/v2/nodes/MicNode';
  import {
    audioInputDevices,
    enumerateAudioDevices,
    hasEnumeratedDevices
  } from '../../../stores/audio-devices.store';
  import { useNodeDataTracker } from '$lib/history';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: MicSettings;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  let audioService = AudioService.getInstance();

  // Undo/redo tracking for node data changes
  const tracker = useNodeDataTracker(nodeId);

  let showSettings = $state(false);
  let micNode: MicNode | null = $state(null);

  // Local form state
  let deviceId = $state(data.deviceId ?? '');
  let echoCancellation = $state(data.echoCancellation ?? true);
  let noiseSuppression = $state(data.noiseSuppression ?? true);
  let autoGainControl = $state(data.autoGainControl ?? true);

  const containerClass = $derived.by(() => {
    return selected ? 'object-container-selected' : 'object-container';
  });

  onMount(async () => {
    if (!$hasEnumeratedDevices) {
      await enumerateAudioDevices();
    }

    const node = await audioService.createNode(nodeId, 'mic~');

    if (node && node instanceof MicNode) {
      micNode = node;

      micNode.updateSettings({
        deviceId: data.deviceId ?? '',
        echoCancellation: data.echoCancellation ?? true,
        noiseSuppression: data.noiseSuppression ?? true,
        autoGainControl: data.autoGainControl ?? true
      });
    }
  });

  onDestroy(() => {
    audioService.removeNodeById(nodeId);
  });

  function applySettings() {
    if (!micNode) return;

    const settings = {
      deviceId,
      echoCancellation,
      noiseSuppression,
      autoGainControl
    };

    micNode.updateSettings(settings);
    updateNodeData(nodeId, settings);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      applySettings();
      showSettings = false;
    } else if (e.key === 'Escape') {
      showSettings = false;
    }
  }
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div></div>
        <div>
          <button
            class="rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              showSettings = !showSettings;
            }}
            title="Configure microphone"
          >
            <Settings class="h-4 w-4 text-zinc-300" />
          </button>
        </div>
      </div>

      <div class="relative">
        <StandardHandle
          port="inlet"
          type="message"
          id={0}
          title="Bang to restart"
          total={1}
          index={0}
          class="top-0"
          {nodeId}
        />

        <button
          class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
          title="Microphone Input"
        >
          <div class="flex items-center justify-center gap-2">
            <Mic class="h-4 w-4 text-zinc-500" />

            <div class="font-mono text-xs text-zinc-300">mic~</div>
          </div>
        </button>

        <StandardHandle
          port="outlet"
          type="audio"
          id={0}
          title="Audio output"
          total={1}
          index={0}
          class="bottom-0"
          {nodeId}
        />
      </div>
    </div>
  </div>

  {#if showSettings}
    <div class="absolute left-20">
      <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
        <button onclick={() => (showSettings = false)} class="rounded p-1 hover:bg-zinc-700">
          <X class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="nodrag ml-2 w-56 rounded-lg border border-zinc-600 bg-zinc-900 p-3 shadow-xl"
        onkeydown={handleKeydown}
      >
        <div class="space-y-3">
          <!-- Device Selection -->
          <div>
            <div class="mb-1 text-[8px] text-zinc-400">Input Device</div>
            <select
              value={deviceId}
              onchange={(e) => {
                const oldDeviceId = deviceId;
                deviceId = (e.target as HTMLSelectElement).value;
                applySettings();
                tracker.commit('deviceId', oldDeviceId, deviceId);
              }}
              class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
            >
              <option value="">Default</option>
              {#each $audioInputDevices as device}
                <option value={device.id}>{device.name}</option>
              {/each}
            </select>
          </div>

          <!-- Processing Flags -->
          <div class="space-y-2">
            <div class="text-[8px] text-zinc-400">Processing (disable for low latency)</div>

            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={echoCancellation}
                onchange={(e) => {
                  const oldValue = echoCancellation;
                  echoCancellation = (e.target as HTMLInputElement).checked;
                  applySettings();
                  tracker.commit('echoCancellation', oldValue, echoCancellation);
                }}
                class="rounded border-zinc-600 bg-zinc-800"
              />
              <span class="text-xs text-zinc-300">Echo Cancellation</span>
            </label>

            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={noiseSuppression}
                onchange={(e) => {
                  const oldValue = noiseSuppression;
                  noiseSuppression = (e.target as HTMLInputElement).checked;
                  applySettings();
                  tracker.commit('noiseSuppression', oldValue, noiseSuppression);
                }}
                class="rounded border-zinc-600 bg-zinc-800"
              />
              <span class="text-xs text-zinc-300">Noise Suppression</span>
            </label>

            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoGainControl}
                onchange={(e) => {
                  const oldValue = autoGainControl;
                  autoGainControl = (e.target as HTMLInputElement).checked;
                  applySettings();
                  tracker.commit('autoGainControl', oldValue, autoGainControl);
                }}
                class="rounded border-zinc-600 bg-zinc-800"
              />
              <span class="text-xs text-zinc-300">Auto Gain Control</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
