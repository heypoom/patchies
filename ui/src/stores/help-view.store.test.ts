import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import { selectedNodeInfo } from './ui.store';
import { helpViewStore, requestedHelpObject, resolveHelpViewTarget } from './help-view.store';

afterEach(() => {
  selectedNodeInfo.set(null);
  requestedHelpObject.set(null);

  helpViewStore.set({
    lastViewed: null,
    guidesExpanded: false,
    objectsExpanded: true,
    isLocked: false
  });
});

describe('help view target selection', () => {
  it('prioritizes explicit help, then a pin, then canvas selection', () => {
    const baseOptions = {
      browseMode: false,
      manualTarget: null,
      lastViewed: { type: 'object' as const, object: 'pinned-object' },
      selectedObject: 'selected-object'
    };

    expect(
      resolveHelpViewTarget({
        ...baseOptions,
        requestedObject: 'requested-object',
        isLocked: true
      })
    ).toEqual({ type: 'object', object: 'requested-object' });

    expect(
      resolveHelpViewTarget({
        ...baseOptions,
        requestedObject: null,
        isLocked: true
      })
    ).toEqual({ type: 'object', object: 'pinned-object' });

    expect(
      resolveHelpViewTarget({
        ...baseOptions,
        requestedObject: null,
        isLocked: false
      })
    ).toEqual({ type: 'object', object: 'selected-object' });
  });

  it('lets an explicit help request override and unpin the current target', () => {
    selectedNodeInfo.set({ id: 'selected-node', type: 'osc~' });
    helpViewStore.setLocked(true);

    helpViewStore.openObject('canvas', 'selected-node');

    expect(get(helpViewStore)).toMatchObject({
      lastViewed: { type: 'object', object: 'canvas' },
      isLocked: false
    });
    expect(get(requestedHelpObject)).toEqual({
      object: 'canvas',
      selectedNodeId: 'selected-node'
    });
  });

  it('keeps the explicit target until a different node is selected', () => {
    selectedNodeInfo.set({ id: 'selected-node', type: 'osc~' });
    helpViewStore.openObject('canvas', 'selected-node');

    selectedNodeInfo.set({ id: 'selected-node', type: 'cycle~' });
    expect(get(requestedHelpObject)?.object).toBe('canvas');

    selectedNodeInfo.set({ id: 'next-node', type: 'cycle~' });
    expect(get(requestedHelpObject)).toBeNull();
  });
});
