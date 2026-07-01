<script lang="ts">
  import type { NodeProps } from '@xyflow/svelte';
  import SmplrNodeLayout from './SmplrNodeLayout.svelte';
  import { smplrDescriptors } from './descriptors';

  let node: NodeProps = $props();
</script>

<SmplrNodeLayout descriptor={smplrDescriptors['versilian~']} {node} />
