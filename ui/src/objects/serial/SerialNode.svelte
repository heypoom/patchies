<script lang="ts">
  import { AlertCircle, Settings, Usb, Unplug } from '@lucide/svelte/icons';
  import { useSvelteFlow } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { SerialSystem } from './SerialSystem';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { MessageSystem } from '$lib/messages/MessageSystem';
  import { match, P } from 'ts-pattern';
  import { messages } from '$lib/objects/schemas';
  import { serialMessages } from './schema';
  import type { SerialNodeData } from './constants';
  import SerialSettings from './SerialSettings.svelte';
  import { serialPorts } from '../../stores/serial.store';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: SerialNodeData;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();
  const serialSystem = SerialSystem.getInstance();
  const messageSystem = MessageSystem.getInstance();

  let messageContext: MessageContext;
  let showSettings = $state(false);
  let errorMessage = $state<string | null>(null);
  let contentWidth = $state(100);

  const portId = $derived(data.portId || '');
  const baudRate = $derived(data.baudRate || 9600);
  const dataBits = $derived(data.dataBits ?? 8);
  const stopBits = $derived(data.stopBits ?? 1);
  const parity = $derived(data.parity ?? 'none');
  const lineEnding = $derived(data.lineEnding ?? '\r\n');

  const portStoreEntry = $derived($serialPorts.find((p) => p.portId === portId));
  const isConnected = $derived(portStoreEntry?.connected ?? false);
  const portLabel = $derived(portStoreEntry?.label ?? 'No port');

  const borderColor = $derived.by(() => {
    if (errorMessage) return 'border-red-500';
    if (isConnected) return 'border-emerald-500';
    if (selected) return 'border-zinc-400';
    return 'border-zinc-600';
  });

  const statusIcon = $derived.by(() => {
    if (errorMessage) return AlertCircle;
    if (isConnected) return Usb;
    return Unplug;
  });

  function subscribeToPort(pid: string) {
    serialSystem.subscribe(pid, {
      nodeId,
      onLine: (line) => {
        messageSystem.sendMessage(nodeId, { type: 'data', line });
      }
    });
  }

  function unsubscribeFromPort(pid: string) {
    serialSystem.unsubscribe(pid, nodeId);
  }

  async function handleConnect(newPortId: string) {
    errorMessage = null;

    messageSystem.sendMessage(nodeId, {
      type: 'connected',
      portId: newPortId,
      label: serialSystem.getPortInfo(newPortId)?.label ?? ''
    });
  }

  async function handleDisconnect() {
    if (portId) {
      await serialSystem.closePort(portId);
      updateNodeData(nodeId, { portId: '' });

      messageSystem.sendMessage(nodeId, { type: 'disconnected', portId });
    }
    errorMessage = null;
  }

  const handleMessage: MessageCallbackFn = async (message) => {
    try {
      await match(message)
        .with(messages.bang, () => {
          if (!portId) {
            showSettings = true;
          }
        })
        .with(serialMessages.connect, () => {
          if (!portId) showSettings = true;
        })
        .with(serialMessages.disconnect, () => handleDisconnect())
        .with(serialMessages.baud, ({ value }) => {
          updateNodeData(nodeId, { baudRate: value });
        })
        .with(serialMessages.sendBreak, async () => {
          if (!portId || !isConnected) {
            errorMessage = 'Not connected';
            return;
          }
          await serialSystem.sendBreak(portId);
        })
        .with(serialMessages.uint8Array, async (bytes) => {
          if (!portId || !isConnected) {
            errorMessage = 'Not connected';
            return;
          }

          await serialSystem.writeRaw(portId, bytes);
        })
        .with(serialMessages.numberArray, async (arr) => {
          if (!portId || !isConnected) {
            errorMessage = 'Not connected';
            return;
          }

          await serialSystem.writeRaw(portId, new Uint8Array(arr));
        })
        .with(P.string, async (text) => {
          if (!portId || !isConnected) {
            errorMessage = 'Not connected';
            return;
          }
          await serialSystem.write(portId, text, lineEnding);
        })
        .otherwise(() => {});
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    }
  };

  // Reactively subscribe/unsubscribe when portId or connection state changes
  $effect(() => {
    const subscribedPort = portId;
    if (subscribedPort && isConnected) {
      subscribeToPort(subscribedPort);

      return () => unsubscribeFromPort(subscribedPort);
    }
  });

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);
  });

  onDestroy(() => {
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
  });
</script>

<div class="relative flex gap-x-3">
  <div class="group relative" bind:clientWidth={contentWidth}>
    <div class="flex flex-col gap-2">
      <div class="absolute -top-7 left-0 flex w-full items-center justify-between">
        <div class="z-10 rounded-lg bg-zinc-900 px-2 py-1">
          <div class="font-mono text-xs font-medium text-zinc-400">serial</div>
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
            onclick={() => (showSettings = true)}
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
            <svelte:component this={statusIcon} class="h-4 w-4" />
            <div class="mt-1 max-w-[100px] truncate text-[10px] text-zinc-500">
              {portLabel}
            </div>
          </button>
        {/if}

        <StandardHandle port="outlet" type="message" total={1} index={0} {nodeId} />
      </div>
    </div>
  </div>

  {#if showSettings}
    <div class="absolute" style="left: {contentWidth + 10}px">
      <SerialSettings
        {nodeId}
        {portId}
        {baudRate}
        {dataBits}
        {stopBits}
        {parity}
        {lineEnding}
        bind:show={showSettings}
        {errorMessage}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
    </div>
  {/if}
</div>
