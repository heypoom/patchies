<script lang="ts">
  import { SvelteFlow, type Node } from '@xyflow/svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import MusicCodeFlowNode from './MusicCodeFlowNode.svelte';
  import type { MusicCodeLayoutData } from '../music-code-layout';
  import '@xyflow/svelte/dist/style.css';
  import '../../../app.css';

  let nodes: Node<MusicCodeLayoutData & Record<string, unknown>>[] = $state([
    { id: 'music-1', type: 'music', position: { x: 80, y: 80 }, data: {} }
  ]);

  export const getNode = () => nodes[0];
</script>

<div class="dark relative h-[600px] w-[800px] bg-black">
  <Tooltip.Provider>
    <SvelteFlow bind:nodes nodeTypes={{ music: MusicCodeFlowNode }} />
  </Tooltip.Provider>
  <div
    data-testid="resize-target"
    class="pointer-events-none absolute top-[440px] left-[560px] h-1 w-1"
  ></div>
</div>
