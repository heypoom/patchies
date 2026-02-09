<script lang="ts">
  import StandardHandle from '$lib/components/StandardHandle.svelte';
  import ObjectCommonLayout from './ObjectCommonLayout.svelte';
  import { GLSystem } from '$lib/canvas/GLSystem';
  import { onDestroy, onMount } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { MessageContext } from '$lib/messages/MessageContext';
  import type { MessageCallbackFn } from '$lib/messages/MessageSystem';

  let node: {
    id: string;
    data: { channel?: string };
    selected: boolean;
  } = $props();

  const { updateNode } = useSvelteFlow();
  let glSystem = GLSystem.getInstance();
  let messageContext: MessageContext;

  let channel = $derived(node.data.channel ?? 'foo');

  const handleMessage: MessageCallbackFn = (m, { inlet }) => {
    // Channel inlet (inlet 0) - accepts string to change channel
    if (inlet === 0 && typeof m === 'string' && m.trim()) {
      updateNode(node.id, { data: { ...node.data, channel: m.trim() } });
    }
  };

  function handleChannelChange(newChannel: string) {
    updateNode(node.id, { data: { ...node.data, channel: newChannel } });
  }

  onMount(() => {
    messageContext = new MessageContext(node.id);
    messageContext.queue.addCallback(handleMessage);
    glSystem.upsertNode(node.id, 'recv.vdo', { channel });
  });

  onDestroy(() => {
    messageContext?.queue.removeCallback(handleMessage);
    messageContext?.destroy();
    glSystem.removeNode(node.id);
  });

  // Update GLSystem when channel changes
  $effect(() => {
    glSystem.upsertNode(node.id, 'recv.vdo', { channel });
  });
</script>

<ObjectCommonLayout
  nodeLabel="recv.vdo"
  {channel}
  selected={node.selected}
  onChannelChange={handleChannelChange}
>
  {#snippet inlets()}
    <StandardHandle
      port="inlet"
      type="message"
      id={0}
      title="Channel name"
      total={1}
      index={0}
      class="top-0"
      nodeId={node.id}
    />
  {/snippet}

  {#snippet outlets()}
    <StandardHandle
      port="outlet"
      type="video"
      id={0}
      title="Video output"
      total={1}
      index={0}
      class="bottom-0"
      nodeId={node.id}
    />
  {/snippet}
</ObjectCommonLayout>
