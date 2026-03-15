<script lang="ts">
  import StandardHandle from './StandardHandle.svelte';
  import type { HandleSpec } from '$lib/objects/schemas/types';

  interface Props {
    port: 'inlet' | 'outlet';
    /** Handle spec from the schema — replaces manual type/id props */
    spec: HandleSpec;
    total: number;
    index: number;
    title?: string;
    class?: string;
    nodeId: string;
    isAudioParam?: boolean;
    acceptsFloat?: boolean;
    isHot?: boolean;
  }

  let { spec, ...rest }: Props = $props();
</script>

<StandardHandle type={spec.handleType} id={spec.handleId} {...rest} />
