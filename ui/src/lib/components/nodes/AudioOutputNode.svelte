<script lang="ts">
  import { Settings, X, Volume2 } from '@lucide/svelte/icons';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { AudioService } from '$lib/audio/v2/AudioService';
  import { AudioOutputNode, type AudioOutputSettings } from '$lib/audio/v2/nodes/AudioOutputNode';
  import {
    audioOutputDevices,
    enumerateAudioDevices,
    hasEnumeratedDevices
  } from '../../../stores/audio-devices.store';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: AudioOutputSettings;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  let audioService = AudioService.getInstance();
  let showSettings = $state(false);
  let audioOutputNode: AudioOutputNode | null = $state(null);

  // Local form state
  let deviceId = $state(data.deviceId ?? '');

  // Check browser capabilities - only Chrome 110+ supports AudioContext.setSinkId
  const supportsDeviceSelection = AudioOutputNode.supportsOutputDeviceSelection;

  const containerClass = $derived.by(() => {
    return selected ? 'object-container-selected' : 'object-container';
  });

  onMount(async () => {
    // Only enumerate devices if browser supports device selection
    if (supportsDeviceSelection && !$hasEnumeratedDevices) {
      await enumerateAudioDevices();
    }

    const node = await audioService.createNode(nodeId, 'out~');

    if (node && node instanceof AudioOutputNode) {
      audioOutputNode = node;

      // Apply saved settings
      if (data.deviceId) {
        audioOutputNode.updateSettings({ deviceId: data.deviceId });
      }
    }
  });

  onDestroy(() => {
    audioService.removeNodeById(nodeId);
  });

  function applySettings() {
    if (!audioOutputNode) return;

    const settings = { deviceId };
    audioOutputNode.updateSettings(settings);
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
      {#if supportsDeviceSelection}
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
              title="Configure output"
            >
              <Settings class="h-4 w-4 text-zinc-300" />
            </button>
          </div>
        </div>
      {/if}

      <div class="relative">
        <StandardHandle
          port="inlet"
          type="audio"
          id={0}
          title="Audio input"
          total={1}
          index={0}
          class="top-0"
          {nodeId}
        />

        <button
          class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
          title="Audio Output"
        >
          <div class="flex items-center justify-center gap-2">
            <Volume2 class="h-4 w-4 text-zinc-500" />

            <div class="font-mono text-xs text-zinc-300">out~</div>
          </div>
        </button>
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
          <div>
            <div class="mb-1 text-[8px] text-zinc-400">Output Device</div>
            <select
              bind:value={deviceId}
              onchange={applySettings}
              class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
            >
              <option value="">Default</option>
              {#each $audioOutputDevices as device}
                <option value={device.id}>{device.name}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
