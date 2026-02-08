<script lang="ts">
  import JSExprBase from './JSExprBase.svelte';

  let {
    id: nodeId,
    data,
    selected
  }: {
    id: string;
    data: { expr: string; showConsole?: boolean };
    selected: boolean;
  } = $props();
</script>

<JSExprBase
  id={nodeId}
  {data}
  {selected}
  displayPrefix="map"
  placeholder="$1 + 1"
  outletTitles={['Output']}
  requireAllInlets
  onResult={(result, _originalMessage, send) => {
    // Map: send the transformed result
    send(result);
  }}
/>
