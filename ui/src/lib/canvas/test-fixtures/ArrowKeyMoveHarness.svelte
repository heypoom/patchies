<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteFlow, type Node } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import { useNodeInteractions } from '../use-node-interactions.svelte';
  import ArrowKeyMoveGuard from '$lib/components/ArrowKeyMoveGuard.svelte';

  let {
    onReady
  }: {
    onReady: (harness: Harness) => void;
  } = $props();

  const interactions = useNodeInteractions(() => 'protected');

  let nodes: Node[] = $state([
    { id: 'protected', position: { x: 0, y: 0 }, data: { label: 'Protected' }, selected: true },
    { id: 'other', position: { x: 200, y: 0 }, data: { label: 'Other' }, selected: true }
  ]);

  const harness = {
    ...interactions.api,
    reset: interactions.reset,
    getState: () => ({ ...interactions.state }),
    getNodes: () => nodes,
    moveSelection: () =>
      document
        .querySelector('[data-id="protected"]')!
        .dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true })
        )
  };

  type Harness = typeof harness;

  onMount(() => onReady(harness));
</script>

<div style="width: 600px; height: 400px;">
  <SvelteFlow bind:nodes edges={[]}>
    <ArrowKeyMoveGuard />
  </SvelteFlow>
</div>
