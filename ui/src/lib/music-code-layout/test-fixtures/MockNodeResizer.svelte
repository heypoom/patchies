<script lang="ts">
  let { isVisible }: { isVisible: boolean } = $props();
</script>

{#if isVisible}<div class="mock-node-resizer"></div>{/if}
