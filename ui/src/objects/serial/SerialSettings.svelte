<script lang="ts">
  import { X, Usb } from '@lucide/svelte/icons';
  import { serialPorts } from '../../stores/serial.store';
  import { SerialSystem } from '$lib/canvas/SerialSystem';
  import { BAUD_RATES, LINE_ENDINGS } from './constants';
  import { useNodeDataTracker } from '$lib/history';
  import { useSvelteFlow } from '@xyflow/svelte';

  let {
    nodeId,
    portId,
    baudRate,
    lineEnding,
    show = $bindable(false),
    errorMessage = null,
    onConnect,
    onDisconnect
  }: {
    nodeId: string;
    portId: string;
    baudRate: number;
    lineEnding: string;
    show: boolean;
    errorMessage?: string | null;
    onConnect: (portId: string) => void;
    onDisconnect: () => void;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const tracker = useNodeDataTracker(nodeId);
  const serialSystem = SerialSystem.getInstance();

  const isConnected = $derived(portId ? serialSystem.isConnected(portId) : false);

  async function handleRequestPort() {
    try {
      const newPortId = await serialSystem.requestPort({ baudRate });
      const oldPortId = portId;
      updateNodeData(nodeId, { portId: newPortId });
      tracker.commit('portId', oldPortId, newPortId);
      onConnect(newPortId);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[serial] failed to request port:', err);
      }
    }
  }

  function handleDisconnect() {
    onDisconnect();
  }
</script>

<div class="relative">
  <div class="absolute -top-7 left-0 flex w-full justify-end gap-x-1">
    <button onclick={() => (show = false)} class="cursor-pointer rounded p-1 hover:bg-zinc-700">
      <X class="h-4 w-4 text-zinc-300" />
    </button>
  </div>

  <div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
    <div class="space-y-4">
      <!-- Port -->
      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="mb-2 block text-xs font-medium text-zinc-300">Serial Port</label>

        {#if $serialPorts.length > 0}
          <select
            class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
            value={portId}
            onchange={(e) => {
              const oldPortId = portId;
              const newPortId = (e.target as HTMLSelectElement).value;
              updateNodeData(nodeId, { portId: newPortId });
              tracker.commit('portId', oldPortId, newPortId);
              if (newPortId) onConnect(newPortId);
            }}
          >
            <option value="">Select port...</option>
            {#each $serialPorts as port}
              <option value={port.portId}>
                {port.label} ({port.baudRate} baud)
              </option>
            {/each}
          </select>
        {:else}
          <p class="text-[10px] text-zinc-500">No ports open yet</p>
        {/if}

        <button
          class="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
          onclick={handleRequestPort}
        >
          <Usb class="h-3 w-3" />
          Request New Port
        </button>
      </div>

      <!-- Baud Rate -->
      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="mb-2 block text-xs font-medium text-zinc-300">Baud Rate</label>

        <select
          class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
          value={baudRate}
          onchange={(e) => {
            const oldBaud = baudRate;
            const newBaud = parseInt((e.target as HTMLSelectElement).value);
            updateNodeData(nodeId, { baudRate: newBaud });
            tracker.commit('baudRate', oldBaud, newBaud);
          }}
        >
          {#each BAUD_RATES as rate}
            <option value={rate}>{rate}</option>
          {/each}
        </select>
      </div>

      <!-- Line Ending -->
      <div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label class="mb-2 block text-xs font-medium text-zinc-300">Line Ending</label>

        <select
          class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
          value={lineEnding}
          onchange={(e) => {
            const oldEnding = lineEnding;
            const newEnding = (e.target as HTMLSelectElement).value;
            updateNodeData(nodeId, { lineEnding: newEnding });
            tracker.commit('lineEnding', oldEnding, newEnding);
          }}
        >
          {#each LINE_ENDINGS as le}
            <option value={le.value}>{le.label}</option>
          {/each}
        </select>
      </div>

      <!-- Disconnect button -->
      {#if isConnected && portId}
        <button
          class="w-full cursor-pointer rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20"
          onclick={handleDisconnect}
        >
          Disconnect
        </button>
      {/if}

      {#if errorMessage}
        <div class="rounded border border-red-700 bg-red-900/20 p-2">
          <p class="text-xs text-red-400">{errorMessage}</p>
        </div>
      {/if}
    </div>
  </div>
</div>
