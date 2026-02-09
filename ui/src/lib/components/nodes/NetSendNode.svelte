<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import ObjectCommonLayout from './ObjectCommonLayout.svelte';
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

  let channel = $derived(data.channel || 'foo');
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

  function handleChannelChange(newChannel: string) {
    updateNodeData(nodeId, { channel: newChannel });
  }

  const borderColorClass = $derived.by(() => {
    if (selected && !isConnected) return 'border-gray-100';
    if (selected) return 'border-emerald-400';
    if (!isConnected) return 'border-gray-500';

    return 'border-emerald-500';
  });

  const labelColorClass = 'text-zinc-200';
</script>

<ObjectCommonLayout
  nodeLabel="netsend"
  {channel}
  {selected}
  {borderColorClass}
  {labelColorClass}
  onChannelChange={handleChannelChange}
>
  {#snippet inlets()}
    <StandardHandle port="inlet" type="message" total={1} index={0} {nodeId} />
  {/snippet}
</ObjectCommonLayout>
