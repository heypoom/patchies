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
  displayPrefix="filter"
  placeholder="$1.type === 'play'"
  outletTitles={['Matched', 'No Match']}
  requireAllInlets
  onResult={(result, originalMessage, send) => {
    // Filter: send to outlet 0 if truthy, outlet 1 (nomatch) if falsy
    if (result) {
      send(originalMessage, { to: 0 });
    } else {
      send(originalMessage, { to: 1 });
    }
  }}
/>
