<script lang="ts">
  import * as Tooltip from '$lib/components/ui/tooltip';
  import CsoundNode from '$objects/csound~/CsoundNode.svelte';
  import ChuckNode from '$objects/chuck~/ChuckNode.svelte';
  import StrudelNode from '$objects/strudel/StrudelNode.svelte';
  import type { MusicCodeLayoutData } from '../music-code-layout';
  import '../../../app.css';

  let {
    kind,
    data
  }: {
    kind: 'csound~' | 'chuck~' | 'strudel';
    data: MusicCodeLayoutData & { expr: string; code: string };
  } = $props();
</script>

<div class="dark min-h-screen bg-black p-12">
  <Tooltip.Provider>
    {#if kind === 'csound~'}
      <CsoundNode id="music-1" {data} selected />
    {:else if kind === 'chuck~'}
      <ChuckNode id="music-1" {data} selected />
    {:else}
      <StrudelNode id="music-1" {data} selected />
    {/if}
  </Tooltip.Provider>
</div>
