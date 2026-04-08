import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import type { IncludeProcessingEvent } from '$lib/eventbus/events';

/**
 * Tracks whether #include preprocessing is active for a given node.
 * Returns a reactive `loading` getter.
 */
export function useIncludeProcessing(nodeId: string) {
  let loading = $state(false);

  $effect(() => {
    const eventBus = PatchiesEventBus.getInstance();

    const handle = (event: IncludeProcessingEvent) => {
      if (event.nodeId !== nodeId) return;

      loading = event.active;
    };

    eventBus.addEventListener('includeProcessing', handle);

    return () => eventBus.removeEventListener('includeProcessing', handle);
  });

  return {
    get loading() {
      return loading;
    }
  };
}
