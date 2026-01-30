<script lang="ts">
  import AudioChannelLayout from './AudioChannelLayout.svelte';

  // Get node data from XY Flow - nodes receive their data as props
  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: {
      channels: number;
    };
    selected: boolean;
  } = $props();
</script>

<AudioChannelLayout
  id={nodeId}
  {data}
  {selected}
  audioType="split~"
  displayName="split~"
  title="Channel Splitter"
/>
