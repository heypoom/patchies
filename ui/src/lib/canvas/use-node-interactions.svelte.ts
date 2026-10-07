import { onDestroy } from 'svelte';
import { PatchiesEventBus } from '$lib/eventbus/PatchiesEventBus';
import type { NodeInteractionMode, NodeInteractionUpdateEvent } from '$lib/eventbus/events';

export function useNodeInteractions(getNodeId: () => string, defaults = { dragEnabled: true }) {
  const eventBus = PatchiesEventBus.getInstance();

  const state = $state({
    dragEnabled: defaults.dragEnabled,
    panEnabled: true,
    wheelEnabled: true,
    arrowKeyMoveEnabled: true
  });

  function handleUpdate(event: NodeInteractionUpdateEvent) {
    if (event.nodeId !== getNodeId()) return;

    if (event.mode === 'interact') {
      state.dragEnabled = event.enabled;
      state.panEnabled = event.enabled;
      state.wheelEnabled = event.enabled;
      state.arrowKeyMoveEnabled = event.enabled;

      return;
    }

    if (event.mode === 'drag') {
      state.dragEnabled = event.enabled;
    }

    if (event.mode === 'pan') {
      state.panEnabled = event.enabled;
    }

    if (event.mode === 'wheel') {
      state.wheelEnabled = event.enabled;
    }

    // Using arrow up/down/left/right keys to move the XYFlow node
    if (event.mode === 'arrowKeyMove') {
      state.arrowKeyMoveEnabled = event.enabled;
    }
  }

  const setInteraction = (mode: NodeInteractionMode, enabled: boolean) =>
    eventBus.dispatch({
      type: 'nodeInteractionUpdate',
      nodeId: getNodeId(),
      mode,
      enabled
    });

  function reset() {
    setInteraction('interact', true);

    state.dragEnabled = defaults.dragEnabled;
  }

  eventBus.addEventListener('nodeInteractionUpdate', handleUpdate);

  onDestroy(() => {
    reset();
    eventBus.removeEventListener('nodeInteractionUpdate', handleUpdate);
  });

  return {
    state,
    reset,
    api: {
      noDrag: () => setInteraction('drag', false),
      noPan: () => setInteraction('pan', false),
      noWheel: () => setInteraction('wheel', false),
      noArrowKeyMove: () => setInteraction('arrowKeyMove', false),
      noInteract: () => setInteraction('interact', false)
    }
  };
}
