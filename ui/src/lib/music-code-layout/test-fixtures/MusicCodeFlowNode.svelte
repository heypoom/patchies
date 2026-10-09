<script lang="ts">
  import MusicCodeContainer from '../MusicCodeContainer.svelte';
  import type { MusicCodeLayoutData } from '../music-code-layout';

  let { id, data }: { id: string; data: MusicCodeLayoutData } = $props();
</script>

<MusicCodeContainer nodeId={id} {data} selected label="strudel" onExpand={() => {}}>
  <div class="h-full overflow-auto font-mono text-xs">s("bd sd")</div>
</MusicCodeContainer>
