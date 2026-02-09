<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import ObjectCommonLayout from './ObjectCommonLayout.svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { P2PManager, type P2PMessageHandler } from '$lib/p2p/P2PManager';
  import { match } from 'ts-pattern';
  import { netrecvMessages } from '$lib/objects/schemas/netrecv';

  let {
    id: nodeId,
    data,
    selected
  }: { id: string; data: { channel: string }; selected: boolean } = $props();

  const { updateNodeData } = useSvelteFlow();
  const messageContext = new MessageContext(nodeId);
  const p2pManager = P2PManager.getInstance();

  let channel = $derived(data.channel || 'foo');
  let peerCount = $state(0);
  let isConnected = $state(false);
  let messagesReceived = $state(0);
  let lastMessage = $state<unknown>(null);
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    p2pManager.initialize();
    messageContext.queue.addCallback(handleMessage);
    subscribeToChannel();

    // Update connection state periodically
    const interval = setInterval(() => {
      peerCount = p2pManager.getPeerCount();
      isConnected = p2pManager.isConnected();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  });

  onDestroy(() => {
    unsubscribe?.();

    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
  });

  // Subscribe to P2P channel messages
  function subscribeToChannel() {
    unsubscribe?.();

    const messageHandler: P2PMessageHandler = (data, peer) => {
      messagesReceived++;
      lastMessage = data;

      // Forward received message to connected nodes
      messageContext.send(data);
    };

    unsubscribe = p2pManager.subscribeToChannel(channel, messageHandler);
  }

  // Re-subscribe when channel changes
  $effect(() => {
    if (channel) subscribeToChannel();
  });

  const handleMessage: MessageCallbackFn = (message) => {
    try {
      match(message)
        .with(netrecvMessages.setChannel, ({ channel }) => {
          updateNodeData(nodeId, { channel: String(channel) });
        })
        .otherwise(() => {});
    } catch (error) {
      console.error('NetRecvNode handleMessage error:', error);
    }
  };

  function handleChannelChange(newChannel: string) {
    updateNodeData(nodeId, { channel: newChannel });
  }

  const borderColorClass = $derived.by(() => {
    if (selected && !isConnected) return 'border-gray-100';
    if (selected) return 'border-blue-400';
    if (!isConnected) return 'border-gray-500';
    return 'border-blue-600';
  });

  const labelColorClass = 'text-zinc-200';
</script>

<ObjectCommonLayout
  nodeLabel="netrecv"
  {channel}
  {selected}
  {borderColorClass}
  {labelColorClass}
  onChannelChange={handleChannelChange}
>
  {#snippet inlets()}
    <StandardHandle port="inlet" type="message" total={1} index={0} {nodeId} />
  {/snippet}

  {#snippet outlets()}
    <StandardHandle port="outlet" type="message" total={1} index={0} {nodeId} />
  {/snippet}
</ObjectCommonLayout>
