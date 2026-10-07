<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import ArrowKeyMoveHarness from './ArrowKeyMoveHarness.svelte';

  let { onReady }: ComponentProps<typeof ArrowKeyMoveHarness> = $props();
</script>

<SvelteFlowProvider>
  <ArrowKeyMoveHarness {onReady} />
</SvelteFlowProvider>
