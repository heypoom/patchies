<script lang="ts">
  import { Settings, Unplug, Lightbulb } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { SerialSystem } from './SerialSystem';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { match } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import { dmxMessages } from './schema';
  import type { DmxNodeData } from './constants';
  import { DMX_SERIAL_OPTIONS } from './constants';
  import { serialPorts } from '../../stores/serial.store';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: DmxNodeData;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const serialSystem = SerialSystem.getInstance();

  let messageContext: MessageContext;
  let errorMessage = $state<string | null>(null);
  let showSettings = $state(false);

  const portId = $derived(data.portId || '');
  const portStoreEntry = $derived($serialPorts.find((p) => p.portId === portId));
  const isConnected = $derived(portStoreEntry?.connected ?? false);
  const portLabel = $derived(portStoreEntry?.label ?? 'No port');

  const borderColor = $derived.by(() => {
    if (errorMessage) return 'border-red-500';
    if (isConnected) return 'border-emerald-500';
    if (selected) return 'border-zinc-400';
    return 'border-zinc-600';
  });

  async function sendFrame(channels: number[] | Uint8Array) {
    if (!portId || !isConnected) {
      errorMessage = 'Not connected';
      return;
    }
    const data = channels instanceof Uint8Array ? channels : new Uint8Array(channels);
    // Pad or slice to exactly 512 channels
    const frame = new Uint8Array(512);
    frame.set(data.slice(0, 512));
    try {
      await serialSystem.sendBreak(portId);
      await serialSystem.writeRaw(portId, new Uint8Array([0x00, ...frame]));
      errorMessage = null;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    }
  }

  async function sendBlackout() {
    await sendFrame(new Uint8Array(512));
  }

  async function handleConnect() {
    try {
      const newPortId = await serialSystem.requestPort(DMX_SERIAL_OPTIONS);
      updateNodeData(nodeId, { portId: newPortId });
      errorMessage = null;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        errorMessage = err instanceof Error ? err.message : String(err);
      }
    }
  }

  async function handleDisconnect() {
    if (portId) {
      await sendBlackout();
      await serialSystem.closePort(portId);
      updateNodeData(nodeId, { portId: '' });
    }
    errorMessage = null;
  }

  const handleMessage: MessageCallbackFn = async (message) => {
    await match(message)
      .with(messages.bang, () => handleConnect())
      .with(dmxMessages.connect, () => handleConnect())
      .with(dmxMessages.disconnect, () => handleDisconnect())
      .with(dmxMessages.blackout, () => sendBlackout())
      .with(dmxMessages.uint8Array, (bytes) => sendFrame(bytes))
      .with(dmxMessages.numberArray, (arr) => sendFrame(arr))
      .otherwise(() => {});
  };

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
  });

  onDestroy(async () => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
    if (portId && isConnected) await sendBlackout();
  });
</script>

<div class="relative flex gap-x-3">
  <div class="group relative">
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
          <div class="font-mono text-xs font-medium text-zinc-400">serial.dmx</div>
        </div>

        <button
          class="cursor-pointer rounded p-1 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 sm:opacity-0"
          onclick={() => (showSettings = !showSettings)}
        >
          <Settings class="h-4 w-4 text-zinc-300" />
        </button>
      </div>

      <div class="relative">
        <StandardHandle port="inlet" type="message" total={1} index={0} {nodeId} />

        {#if !portId}
          <button
            class={[
              'flex w-full cursor-pointer flex-col items-center justify-center rounded-md border bg-zinc-900 px-3 py-2 text-zinc-300 hover:bg-zinc-800',
              'border-amber-500',
              selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm'
            ]}
            onclick={handleConnect}
          >
            <Settings class="mb-1 h-4 w-4" />
            <div class="text-[10px]">
              <span class="text-amber-400">Select port</span>
            </div>
          </button>
        {:else}
          <button
            class={[
              'flex w-full cursor-pointer flex-col items-center justify-center rounded-md border bg-zinc-900 p-3 pb-2 text-zinc-300 hover:bg-zinc-800',
              borderColor,
              selected ? 'shadow-glow-md' : 'hover:shadow-glow-sm'
            ]}
            onclick={() => (showSettings = !showSettings)}
          >
            {#if isConnected}
              <Lightbulb class="h-4 w-4" />
            {:else}
              <Unplug class="h-4 w-4" />
            {/if}
            <div class="mt-1 max-w-[100px] truncate text-[10px] text-zinc-500">
              {portLabel}
            </div>
          </button>
        {/if}
      </div>

      {#if errorMessage}
        <div class="max-w-[120px] truncate text-[10px] text-red-400">{errorMessage}</div>
      {/if}
    </div>
  </div>

  {#if showSettings}
    <div class="absolute top-0 left-[calc(100%+8px)] z-10">
      <div class="nodrag w-52 rounded-lg border border-zinc-600 bg-zinc-900 p-4 shadow-xl">
        <div class="mb-3 text-xs font-medium text-zinc-300">DMX Port</div>
        <div class="space-y-2 text-[10px] text-zinc-500">
          <div>250000 baud · 8N2 · no parity</div>
        </div>
        <button
          class="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
          onclick={() => {
            showSettings = false;
            handleConnect();
          }}
        >
          <Lightbulb class="h-3 w-3" />
          Request Port
        </button>
        {#if isConnected && portId}
          <button
            class="mt-2 w-full cursor-pointer rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20"
            onclick={() => {
              showSettings = false;
              handleDisconnect();
            }}
          >
            Disconnect
          </button>
        {/if}
        {#if errorMessage}
          <div class="mt-2 rounded border border-red-700 bg-red-900/20 p-2">
            <p class="text-xs text-red-400">{errorMessage}</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
