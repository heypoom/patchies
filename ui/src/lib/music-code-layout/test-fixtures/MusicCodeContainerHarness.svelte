<script lang="ts">
  import type { MusicCodeLayoutData } from '../music-code-layout';
  import MusicCodeContainer from '../MusicCodeContainer.svelte';
  import PersistentMusicEditor from './PersistentMusicEditor.svelte';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import '../../../app.css';

  let {
    data,
    value,
    expanded,
    onExpand,
    onMount,
    onDestroy
  }: {
    data: MusicCodeLayoutData;
    value: string;
    expanded: boolean;
    onExpand: () => void;
    onMount: () => void;
    onDestroy: () => void;
  } = $props();
</script>

{#snippet actions()}
  <button class="cursor-pointer rounded p-1 text-xs hover:bg-zinc-700">Replace</button>
  <button class="cursor-pointer rounded p-1 text-xs hover:bg-zinc-700">Add</button>
  <button class="cursor-pointer rounded p-1 text-xs hover:bg-zinc-700">Remove</button>
{/snippet}

<div class="dark min-h-screen bg-black p-12">
  <Tooltip.Provider>
    <MusicCodeContainer
      nodeId="music-1"
      label="chuck~"
      status="3 shreds"
      selected
      {data}
      {expanded}
      {onExpand}
      {actions}
    >
      <PersistentMusicEditor {value} {onMount} {onDestroy} />
    </MusicCodeContainer>
  </Tooltip.Provider>
</div>
