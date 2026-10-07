<script lang="ts">
  import { useDomPreviewKeyboard } from '../useDomPreviewKeyboard.svelte';

  let { onReady }: { onReady: (keyboard: ReturnType<typeof useDomPreviewKeyboard>) => void } =
    $props();
  let preview = $state<HTMLDivElement>();
  let root = $state<HTMLDivElement>();

  const keyboard = useDomPreviewKeyboard({
    getRoot: () => root,
    getPreview: () => preview,
    onError: (error) => {
      throw error;
    }
  });

  $effect(() => {
    onReady(keyboard);
  });
</script>

<div bind:this={preview} {...keyboard.previewAttributes}>
  <div bind:this={root}></div>
</div>
