<script lang="ts">
  import { Settings, X, Radio, Plus, Trash2, Dice5, Info } from '@lucide/svelte/icons';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import { match, P } from 'ts-pattern';
  import type { MqttClient } from 'mqtt';

  export type MqttNodeData = {
    topics: string[];
    decodeAsString?: boolean; // default true
  };

  type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

  const TEST_BROKERS = ['wss://test.mosquitto.org:8081/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: MqttNodeData;
    selected: boolean;
  } = $props();

  const { updateNodeData } = useSvelteFlow();

  let showSettings = $state(false);
  let connectionStatus = $state<ConnectionStatus>('disconnected');
  let errorMessage = $state('');

  // MQTT state
  let mqtt: typeof import('mqtt').default | null = $state(null);
  let client: MqttClient | null = $state(null);

  // Local state (URL not persisted for security - may contain credentials)
  let url = $state('');
  let newTopic = $state('');

  // Message context for inlet/outlet communication
  let messageContext: MessageContext;

  const containerClass = $derived.by(() => {
    const baseClass = selected ? 'object-container-selected' : 'object-container';

    const statusClass = match(connectionStatus)
      .with('connected', () => 'border-green-500')
      .with('error', () => 'border-red-500')
      .with('connecting', () => 'border-yellow-500')
      .otherwise(() => '');

    return [baseClass, statusClass];
  });

  const statusDot = $derived.by(() =>
    match(connectionStatus)
      .with('connected', () => 'bg-green-500')
      .with('error', () => 'bg-red-500')
      .with('connecting', () => 'bg-yellow-500 animate-pulse')
      .otherwise(() => 'bg-zinc-500')
  );

  onMount(async () => {
    messageContext = new MessageContext(nodeId);
    messageContext.queue.addCallback(handleMessage);

    try {
      const { default: mqttModule } = await import('mqtt');
      mqtt = mqttModule;
    } catch (err) {
      connectionStatus = 'error';
      errorMessage = 'Failed to load MQTT library';
      messageContext.send({ type: 'error', message: errorMessage });
    }
  });

  onDestroy(() => {
    disconnect();
    if (messageContext) {
      messageContext.queue.removeCallback(handleMessage);
      messageContext.destroy();
    }
  });

  let connectionTimeout: ReturnType<typeof setTimeout> | null = null;

  function connect(brokerUrl: string, initialTopics: string[] = []) {
    if (!mqtt || !brokerUrl) return;

    disconnect();
    connectionStatus = 'connecting';
    errorMessage = '';

    // Set connection timeout (10 seconds)
    connectionTimeout = setTimeout(() => {
      if (connectionStatus === 'connecting') {
        connectionStatus = 'error';
        errorMessage = 'Connection timeout - broker unreachable';
        messageContext.send({ type: 'error', message: errorMessage });
        client?.end();
        client = null;
      }
    }, 10000);

    try {
      client = mqtt.connect(brokerUrl, {
        connectTimeout: 10000,
        reconnectPeriod: 0 // Disable auto-reconnect for clearer error states
      });

      client.on('connect', () => {
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
        connectionStatus = 'connected';
        errorMessage = '';
        messageContext.send({ type: 'connected' });

        if (initialTopics.length > 0) {
          subscribeToTopics(initialTopics);
        }
      });

      client.on('message', (topic: unknown, message: unknown) => {
        const shouldDecode = data.decodeAsString !== false; // default true

        const messageOutput =
          shouldDecode && message instanceof Uint8Array
            ? new TextDecoder().decode(message)
            : message;

        messageContext.send({
          type: 'message',
          topic: String(topic),
          message: messageOutput
        });
      });

      client.on('error', (err: unknown) => {
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }

        connectionStatus = 'error';
        errorMessage = err instanceof Error ? err.message : 'Connection error';
        messageContext.send({ type: 'error', message: errorMessage });
      });

      client.on('close', () => {
        // If we were still connecting when closed, it's a connection failure
        if (connectionStatus === 'connecting') {
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }

          connectionStatus = 'error';
          errorMessage = 'Connection failed - check broker URL';
          messageContext.send({ type: 'error', message: errorMessage });
        } else if (connectionStatus !== 'error') {
          connectionStatus = 'disconnected';
          messageContext.send({ type: 'disconnected' });
        }
      });

      client.on('offline', () => {
        if (connectionStatus === 'connected') {
          connectionStatus = 'error';
          errorMessage = 'Connection lost';
          messageContext.send({ type: 'error', message: errorMessage });
        }
      });
    } catch (err) {
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      connectionStatus = 'error';
      errorMessage = err instanceof Error ? err.message : 'Failed to connect';
    }
  }

  function disconnect() {
    const wasConnected = connectionStatus === 'connected';

    if (client) {
      client.end();
      client = null;
    }

    connectionStatus = 'disconnected';
    if (wasConnected) {
      messageContext.send({ type: 'disconnected' });
    }
  }

  function subscribeToTopics(topicList: string[]) {
    if (!client || topicList.length === 0) return;

    client.subscribe(topicList, (err) => {
      if (err) {
        messageContext.send({ type: 'error', message: `Subscribe failed: ${err.message}` });
      } else {
        messageContext.send({ type: 'subscribed', topics: topicList });
      }
    });
  }

  function unsubscribeFromTopics(topicList: string[]) {
    if (!client || topicList.length === 0) return;

    client.unsubscribe(topicList, (err) => {
      if (err) {
        messageContext.send({ type: 'error', message: `Unsubscribe failed: ${err.message}` });
      } else {
        messageContext.send({ type: 'unsubscribed', topics: topicList });
      }
    });
  }

  function updateTopics(newTopics: string[]) {
    const oldTopics = new Set(data.topics ?? []);
    const newTopicsSet = new Set(newTopics);

    // Update node data
    updateNodeData(nodeId, { topics: newTopics });

    // Update subscriptions if connected
    if (client && connectionStatus === 'connected') {
      const toUnsubscribe = [...oldTopics].filter((t) => !newTopicsSet.has(t));
      const toSubscribe = [...newTopicsSet].filter((t) => !oldTopics.has(t));

      if (toUnsubscribe.length > 0) {
        unsubscribeFromTopics(toUnsubscribe);
      }
      if (toSubscribe.length > 0) {
        subscribeToTopics(toSubscribe);
      }
    }
  }

  function addTopic() {
    if (!newTopic.trim()) return;
    const currentTopics = data.topics ?? [];
    if (!currentTopics.includes(newTopic.trim())) {
      updateTopics([...currentTopics, newTopic.trim()]);
    }
    newTopic = '';
  }

  function removeTopic(topic: string) {
    const currentTopics = data.topics ?? [];

    updateTopics(currentTopics.filter((t: string) => t !== topic));
  }

  function useTestBroker() {
    const randomBroker = TEST_BROKERS[Math.floor(Math.random() * TEST_BROKERS.length)];
    url = randomBroker;

    connect(url, data.topics ?? []);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (document.activeElement?.getAttribute('data-topic-input')) {
        addTopic();
      } else if (document.activeElement?.getAttribute('data-url-input')) {
        connect(url, data.topics ?? []);
      } else {
        showSettings = false;
      }
    } else if (e.key === 'Escape') {
      showSettings = false;
    }
  }

  function handleMessage(msg: unknown) {
    if (!isObjectMessage(msg)) return;

    match(msg)
      .with({ type: 'connect', url: P.string }, (m) => {
        url = m.url;
        connect(url, data.topics ?? []);
      })
      .with({ type: 'subscribe', topic: P.union(P.string, P.array(P.string)) }, (m) => {
        const currentTopics = data.topics ?? [];
        const newTopics = Array.isArray(m.topic) ? m.topic.map(String) : [String(m.topic)];

        updateTopics([...new Set([...currentTopics, ...newTopics])]);
      })
      .with({ type: 'unsubscribe', topic: P.union(P.string, P.array(P.string)) }, (m) => {
        const currentTopics = data.topics ?? [];
        const removeTopics = Array.isArray(m.topic) ? m.topic.map(String) : [String(m.topic)];

        updateTopics(currentTopics.filter((t: string) => !removeTopics.includes(t)));
      })
      .with({ type: 'publish', topic: P.string, message: P.any }, (m) => {
        client?.publish(m.topic, String(m.message));
      })
      .with({ type: 'disconnect' }, () => {
        disconnect();
      })
      .otherwise(() => {});
  }

  function isObjectMessage(data: unknown): data is { type: string; [key: string]: unknown } {
    return typeof data === 'object' && data !== null && 'type' in data;
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
            title="Configure MQTT"
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
          title="connect, disconnect, subscribe, unsubscribe, publish"
          total={1}
          index={0}
          class="top-0"
          {nodeId}
        />

        <button
          class={['cursor-pointer rounded-lg border px-3 py-2', containerClass]}
          title={errorMessage || `MQTT ${connectionStatus}`}
        >
          <div class="flex items-center justify-center gap-2">
            <div class="relative">
              <Radio class="h-4 w-4 text-zinc-500" />
            </div>

            <div class="font-mono text-xs text-zinc-300">mqtt</div>
          </div>
        </button>

        <StandardHandle
          port="outlet"
          type="message"
          id={0}
          title="output"
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
        class="nodrag ml-2 w-64 rounded-lg border border-zinc-600 bg-zinc-900 p-3 shadow-xl"
        onkeydown={handleKeydown}
      >
        <div class="space-y-3">
          <!-- Connection Status -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class={['h-2 w-2 rounded-full', statusDot]}></div>
              <span class="text-xs text-zinc-400">
                {match(connectionStatus)
                  .with('connected', () => 'Connected')
                  .with('connecting', () => 'Connecting...')
                  .with('error', () => errorMessage || 'Error')
                  .otherwise(() => 'Disconnected')}
              </span>
            </div>

            <!-- Message API hint -->
            <div class="group relative">
              <Info class="h-3 w-3 cursor-help text-zinc-500 hover:text-zinc-300" />
              <div
                class="pointer-events-none absolute top-5 right-0 z-50 hidden w-56 rounded border border-zinc-600 bg-zinc-800 p-2 text-[9px] shadow-lg group-hover:block"
              >
                <div class="mb-1.5 font-semibold text-zinc-300">Inlet Messages</div>
                <div class="space-y-1 text-zinc-400">
                  <div><span class="text-green-400">connect</span> {`{url: 'wss://...'}`}</div>
                  <div><span class="text-green-400">disconnect</span></div>
                  <div>
                    <span class="text-green-400">publish</span>
                    {`{topic: '...', message: '...'}`}
                  </div>
                  <div><span class="text-green-400">subscribe</span> {`{topic: '...'}`}</div>
                  <div><span class="text-green-400">unsubscribe</span> {`{topic: '...'}`}</div>
                </div>
                <div class="mt-2 mb-1.5 font-semibold text-zinc-300">Outlet Messages</div>
                <div class="space-y-1 text-zinc-400">
                  <div><span class="text-blue-400">connected</span></div>
                  <div><span class="text-blue-400">disconnected</span></div>
                  <div><span class="text-blue-400">message</span> {`{topic, message}`}</div>
                  <div><span class="text-blue-400">subscribed</span> {`{topics: [...]}`}</div>
                  <div><span class="text-blue-400">unsubscribed</span> {`{topics: [...]}`}</div>
                  <div><span class="text-blue-400">error</span> {`{message: '...'}`}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Broker URL -->
          <div>
            <div class="mb-1 flex items-center justify-between">
              <span class="text-[8px] text-zinc-400">Broker URL</span>
              <button
                onclick={useTestBroker}
                class="flex items-center gap-1 rounded bg-zinc-700 px-1.5 py-0.5 text-[8px] text-zinc-300 hover:bg-zinc-600"
                title="Use a random test broker"
              >
                <Dice5 class="h-2.5 w-2.5" />

                Random
              </button>
            </div>
            <input
              type="text"
              bind:value={url}
              data-url-input="true"
              placeholder="wss://broker.example.com"
              class="w-full rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-400 focus:outline-none"
            />
            <div class="mt-1 text-[7px] text-zinc-500">Not saved (may contain credentials)</div>
          </div>

          <!-- Topics -->
          <div>
            <div class="mb-1 text-[8px] text-zinc-400">Subscribed Topics</div>

            <!-- Topic list -->
            {#if (data.topics ?? []).length > 0}
              <div class="mb-2 space-y-1">
                {#each data.topics ?? [] as topic}
                  <div
                    class="flex items-center justify-between rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                  >
                    <span class="truncate">{topic}</span>
                    <button
                      onclick={() => removeTopic(topic)}
                      class="ml-2 cursor-pointer text-zinc-500 hover:text-red-400"
                      title="Remove topic"
                    >
                      <Trash2 class="h-3 w-3" />
                    </button>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Add topic -->
            <div class="flex gap-1">
              <input
                type="text"
                bind:value={newTopic}
                data-topic-input="true"
                placeholder="topic/name"
                class="flex-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-400 focus:outline-none"
              />
              <button
                onclick={addTopic}
                class="rounded bg-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-600"
                title="Add topic"
              >
                <Plus class="h-3 w-3" />
              </button>
            </div>
          </div>

          <!-- Decode as string checkbox -->
          <label class="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={data.decodeAsString !== false}
              onchange={() =>
                updateNodeData(nodeId, { decodeAsString: !(data.decodeAsString !== false) })}
              class="h-3 w-3 cursor-pointer accent-green-600"
            />
            <span class="text-[8px] text-zinc-400">Decode messages as string</span>
          </label>

          <!-- Connect/Disconnect button -->
          <div>
            {#if connectionStatus === 'connected'}
              <button
                onclick={disconnect}
                class="w-full rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500"
              >
                Disconnect
              </button>
            {:else}
              <button
                onclick={() => connect(url, data.topics ?? [])}
                disabled={!url || connectionStatus === 'connecting'}
                class="w-full rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
