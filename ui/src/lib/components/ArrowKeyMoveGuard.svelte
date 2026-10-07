<script lang="ts">
  import { onDestroy } from 'svelte';
  import { useStore } from '@xyflow/svelte';
  import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
  import { installArrowKeyMoveGuard } from '$lib/canvas/arrow-key-move-guard';

  const guard = installArrowKeyMoveGuard(useStore());
  const eventBus = PatchiesEventBus.getInstance();

  eventBus.addEventListener('nodeInteractionUpdate', guard.handleInteractionUpdate);

  onDestroy(() => {
    eventBus.removeEventListener('nodeInteractionUpdate', guard.handleInteractionUpdate);
    guard.destroy();
  });
</script>
