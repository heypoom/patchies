<script lang="ts">
  import { X, Usb } from '@lucide/svelte/icons';
  import { serialPorts } from '../../stores/serial.store';
  import { SerialSystem } from './SerialSystem';
  import {
    BAUD_RATES,
    DATA_BITS,
    STOP_BITS,
    PARITY_OPTIONS,
    LINE_ENDINGS,
    type SerialParity
  } from './constants';
  import { useNodeDataTracker } from '$lib/history';
  import { useSvelteFlow } from '@xyflow/svelte';

  let {
    nodeId,
    portId,
    baudRate,
    dataBits,
    stopBits,
    parity,
    lineEnding,
    resizable,
    show = $bindable(false),
    errorMessage = null,
    onConnect,
    onDisconnect
  }: {
    nodeId: string;
    portId: string;
    baudRate: number;
    dataBits: number;
    stopBits: number;
    parity: SerialParity;
    lineEnding: string;
    resizable?: boolean;
    show: boolean;
    errorMessage?: string | null;
    onConnect: (portId: string) => void;
    onDisconnect: () => void;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const tracker = useNodeDataTracker(nodeId);
  const serialSystem = SerialSystem.getInstance();

  const isConnected = $derived($serialPorts.some((p) => p.portId === portId && p.connected));

  async function handleRequestPort() {
    try {
      const newPortId = await serialSystem.requestPort({
        baudRate,
        dataBits: dataBits as 7 | 8,
        stopBits: stopBits as 1 | 2,
        parity
      });
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
    <button
      aria-label="Close serial settings"
      onclick={() => (show = false)}
      class="cursor-pointer rounded p-1 hover:bg-zinc-700"
    >
      <X class="h-4 w-4 text-zinc-300" />
    </button>
  </div>

  <div class="nodrag w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
    <div class="space-y-4">
      <!-- Port -->
      <div>
        <label for="serial-port-{nodeId}" class="mb-2 block text-xs font-medium text-zinc-300"
          >Serial Port</label
        >

        {#if $serialPorts.length > 0}
          <select
            id="serial-port-{nodeId}"
            class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
            value={portId}
            onchange={(e) => {
              const oldPortId = portId;
              const newPortId = (e.target as HTMLSelectElement).value;
              updateNodeData(nodeId, { portId: newPortId });
              tracker.commit('portId', oldPortId, newPortId);
              const selected = $serialPorts.find((p) => p.portId === newPortId);
              if (newPortId && selected?.connected) onConnect(newPortId);
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
        <label for="serial-baud-{nodeId}" class="mb-2 block text-xs font-medium text-zinc-300"
          >Baud Rate</label
        >

        <select
          id="serial-baud-{nodeId}"
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

      <!-- Data Bits -->
      <div>
        <label for="serial-databits-{nodeId}" class="mb-2 block text-xs font-medium text-zinc-300"
          >Data Bits</label
        >
        <select
          id="serial-databits-{nodeId}"
          class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
          value={dataBits}
          onchange={(e) => {
            const old = dataBits;
            const val = parseInt((e.target as HTMLSelectElement).value);
            updateNodeData(nodeId, { dataBits: val });
            tracker.commit('dataBits', old, val);
          }}
        >
          {#each DATA_BITS as bits}
            <option value={bits}>{bits}</option>
          {/each}
        </select>
      </div>

      <!-- Stop Bits -->
      <div>
        <label for="serial-stopbits-{nodeId}" class="mb-2 block text-xs font-medium text-zinc-300"
          >Stop Bits</label
        >
        <select
          id="serial-stopbits-{nodeId}"
          class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
          value={stopBits}
          onchange={(e) => {
            const old = stopBits;
            const val = parseInt((e.target as HTMLSelectElement).value);
            updateNodeData(nodeId, { stopBits: val });
            tracker.commit('stopBits', old, val);
          }}
        >
          {#each STOP_BITS as bits}
            <option value={bits}>{bits}</option>
          {/each}
        </select>
      </div>

      <!-- Parity -->
      <div>
        <label for="serial-parity-{nodeId}" class="mb-2 block text-xs font-medium text-zinc-300"
          >Parity</label
        >
        <select
          id="serial-parity-{nodeId}"
          class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-100"
          value={parity}
          onchange={(e) => {
            const old = parity;
            const val = (e.target as HTMLSelectElement).value as SerialParity;
            updateNodeData(nodeId, { parity: val });
            tracker.commit('parity', old, val);
          }}
        >
          {#each PARITY_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>

      <!-- Line Ending -->
      <div>
        <label
          for="serial-line-ending-{nodeId}"
          class="mb-2 block text-xs font-medium text-zinc-300">Line Ending</label
        >

        <select
          id="serial-line-ending-{nodeId}"
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

      <!-- Resizable -->
      {#if resizable !== undefined}
        <label class="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={resizable}
            onchange={() => {
              const old = resizable;
              updateNodeData(nodeId, { resizable: !resizable });
              tracker.commit('resizable', old, !resizable);
            }}
            class="cursor-pointer accent-emerald-500"
          />
          <span class="text-xs text-zinc-300">Resizable</span>
        </label>
      {/if}

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
