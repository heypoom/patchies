<script lang="ts">
  import { Settings, X, Rss } from '@lucide/svelte/icons';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { match } from 'ts-pattern';
  import { sseMessages } from '$lib/objects/schemas/sse';

  export type EventSourceNodeData = {
    url: string;
  };

  type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: EventSourceNodeData;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  let showSettings = $state(false);
  let connectionStatus = $state<ConnectionStatus>('disconnected');
  let eventSource: EventSource | null = $state(null);
  let messageContext: MessageContext;

  const containerClass = $derived.by(() => {
    const baseClass = selected ? 'object-container-selected' : 'object-container';

    if (connectionStatus === 'connected') return [baseClass, 'border-green-500'];
    if (connectionStatus === 'error') return [baseClass, 'border-red-500'];
    if (connectionStatus === 'connecting') return [baseClass, 'border-yellow-500'];
    return [baseClass];
  });

  onMount(() => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    if (data.url) {
      connect(data.url);
    }
  });

  onDestroy(() => {
    disconnect();
    if (messageContext) {
      messageContext.queue.removeCallback(handleMessage);
      messageContext.destroy();
    }
  });

  function handleMessage(msg: unknown) {
    if (typeof msg !== 'object' || msg === null || !('type' in msg)) return;

    match(msg)
      .with(sseMessages.connect, (m) => {
        updateNodeData(nodeId, { url: m.url });
        connect(m.url);
      })
      .with(sseMessages.disconnect, () => {
        disconnect();
      })
      .otherwise(() => {});
  }

  function connect(url: string) {
    if (!url) return;

    disconnect();
    connectionStatus = 'connecting';

    try {
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        connectionStatus = 'connected';
      };

      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          messageContext.send(parsed);
        } catch {
          // If not JSON, send as string
          messageContext.send(e.data);
        }
      };

      eventSource.onerror = () => {
        connectionStatus = 'error';
      };
    } catch {
      connectionStatus = 'error';
    }
  }

  function disconnect() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    connectionStatus = 'disconnected';
  }

  function handleUrlChange(newUrl: string) {
    updateNodeData(nodeId, { url: newUrl });
    if (newUrl) {
      connect(newUrl);
    } else {
      disconnect();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === 'Escape') {
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
            class="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            onclick={() => (showSettings = !showSettings)}
            title="Settings"
          >
            <Settings class="h-3 w-3" />
          </button>
        </div>
      </div>

      <div class="relative">
        <StandardHandle
          port="inlet"
          type="message"
          title="connect, disconnect"
          total={1}
          index={0}
          class="top-0"
          {nodeId}
        />

        <StandardHandle
          port="outlet"
          type="message"
          title="SSE messages"
          total={1}
          index={0}
          class="top-0"
          {nodeId}
        />

        <button
          class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
          onclick={() => (showSettings = !showSettings)}
        >
          <div class="flex items-center gap-2">
            <Rss class="h-3 w-3 text-zinc-400" />
            <span class="font-mono text-xs text-zinc-300">sse</span>
          </div>
        </button>
      </div>
    </div>
  </div>

  {#if showSettings}
    <div
      role="dialog"
      tabindex="-1"
      class="absolute top-0 left-full z-10 ml-2 w-64 rounded-lg border border-zinc-600 bg-zinc-800 p-3 shadow-lg"
      onkeydown={handleKeydown}
    >
      <div class="space-y-3">
        <!-- Connection Status -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div
              class={[
                'h-2 w-2 rounded-full',
                connectionStatus === 'connected'
                  ? 'bg-green-500'
                  : connectionStatus === 'error'
                    ? 'bg-red-500'
                    : connectionStatus === 'connecting'
                      ? 'animate-pulse bg-yellow-500'
                      : 'bg-zinc-500'
              ]}
            ></div>
            <span class="text-xs text-zinc-400">
              {#if connectionStatus === 'connected'}
                Connected
              {:else if connectionStatus === 'connecting'}
                Connecting...
              {:else if connectionStatus === 'error'}
                Connection failed
              {:else}
                Disconnected
              {/if}
            </span>
          </div>
          <button
            onclick={() => (showSettings = false)}
            class="cursor-pointer text-zinc-400 hover:text-zinc-200"
          >
            <X class="h-3 w-3" />
          </button>
        </div>

        <!-- URL Input -->
        <div>
          <span class="mb-1 block text-[10px] text-zinc-500">Event Source URL</span>
          <input
            type="text"
            value={data.url ?? ''}
            onchange={(e) => handleUrlChange(e.currentTarget.value)}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                handleUrlChange(e.currentTarget.value);
              }
            }}
            placeholder="https://example.com/events"
            class="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <!-- Connect/Disconnect button -->
        <div>
          {#if connectionStatus === 'connected'}
            <button
              onclick={disconnect}
              class="w-full cursor-pointer rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500"
            >
              Disconnect
            </button>
          {:else}
            <button
              onclick={() => data.url && connect(data.url)}
              disabled={!data.url || connectionStatus === 'connecting'}
              class="w-full cursor-pointer rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
