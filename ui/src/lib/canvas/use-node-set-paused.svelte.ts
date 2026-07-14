import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';

/**
 * Reactive effect: listen for nodeSetPaused events and call toggle
 * if the requested state differs from the current state.
 */
export function useNodeSetPaused(
  nodeId: string | (() => string),
  getCurrentPaused: () => boolean,
  toggle: () => void
) {
  $effect(() => {
    const eventBus = PatchiesEventBus.getInstance();
    const getNodeId = typeof nodeId === 'function' ? nodeId : () => nodeId;

    const handle = (event: { nodeId: string; paused: boolean }) => {
      if (event.nodeId !== getNodeId()) return;

      if (event.paused !== getCurrentPaused()) toggle();
    };

    eventBus.addEventListener('nodeSetPaused', handle);

    return () => eventBus.removeEventListener('nodeSetPaused', handle);
  });
}
