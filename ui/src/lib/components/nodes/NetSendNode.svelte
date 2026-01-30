<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import NetObjectCommonLayout from './NetObjectCommonLayout.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';
  import { P2PManager } from '$lib/p2p/P2PManager';
  import { match, P } from 'ts-pattern';

  let {
    id: nodeId,
    data,
    selected
  }: { id: string; data: { channel: string }; selected: boolean } = $props();

  const { updateNodeData } = useSvelteFlow();
  const messageContext = new MessageContext(nodeId);
  const p2pManager = P2PManager.getInstance();

  let channel = $derived(data.channel || '1');
  let showChannelInput = $state(false);
  let peerCount = $state(0);
  let isConnected = $state(false);
  let messagesSent = $state(0);

  // Initialize P2P manager
  onMount(() => {
    p2pManager.initialize();
    messageContext.queue.addCallback(handleMessage);

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
    messageContext.queue.removeCallback(handleMessage);
    messageContext.destroy();
  });

  const handleMessage: MessageCallbackFn = (message) => {
    try {
      match(message)
        .with({ type: 'set-channel', channel: P.union(P.string, P.number) }, ({ channel }) => {
          updateNodeData(nodeId, { channel: String(channel) });
        })
        .otherwise((msg) => sendMessage(msg));
    } catch (error) {
      console.error('NetSendNode handleMessage error:', error);
    }
  };

  function sendMessage(message: unknown) {
    try {
      p2pManager.sendToChannel(channel, message);
      messagesSent++;
    } catch (error) {
      console.error('Error sending P2P message:', error);
    }
  }

  const borderColor = $derived.by(() => {
    if (selected && !isConnected) return 'border-gray-100';
    if (selected) return 'border-green-400';
    if (!isConnected) return 'border-gray-500';

    return 'border-green-600';
  });

  const textClass = $derived.by(() => {
    if (!isConnected) return 'text-gray-400';

    return 'text-green-200';
  });

  function handleChannelInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    updateNodeData(nodeId, { channel: target.value });
  }

  function handleChannelKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      showChannelInput = false;
    }
  }
</script>

<NetObjectCommonLayout
  {nodeId}
  bind:showChannelInput
  {peerCount}
  {channel}
  {borderColor}
  {textClass}
  {selected}
  nodeLabel="netsend"
  onChannelInput={handleChannelInput}
  onChannelKeydown={handleChannelKeydown}
/>
