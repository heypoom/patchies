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
  displayPrefix="tap"
  placeholder="console.log($1)"
  outletTitles={['Output']}
  bangAsValue
  onResult={(_result, originalMessage, send) => {
    // Tap: execute expression for side effects, always pass through original
    send(originalMessage);
  }}
/>
