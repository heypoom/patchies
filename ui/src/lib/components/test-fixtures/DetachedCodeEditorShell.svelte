<script lang="ts">
  import type { Snippet } from 'svelte';

  let { codeEditor }: { codeEditor: Snippet } = $props();
</script>

{@render codeEditor()}
