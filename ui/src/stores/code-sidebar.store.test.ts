import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import {
  codeSidebarSelection,
  codeSidebarTargets,
  registerCodeSidebarTarget,
  requestCodeSidebarTargetId
} from './code-sidebar.store';

afterEach(() => {
  codeSidebarTargets.set(new Map());
  codeSidebarSelection.set({
    activeTargetId: null,
    pinnedTargetId: null,
    lastSelectedNodeId: null,
    lastSelectedNodeTargetId: null
  });
  requestCodeSidebarTargetId.set(null);
});

describe('code sidebar targets', () => {
  it('keeps the current accessor when an older registration is cleaned up', () => {
    const first = {
      nodeId: 'node-1',
      dataKey: 'code',
      language: 'javascript' as const,
      label: 'First',
      value: 'first'
    };
    const second = { ...first, label: 'Second', value: 'second' };

    const unregisterFirst = registerCodeSidebarTarget(first);
    const unregisterSecond = registerCodeSidebarTarget(second);
    unregisterFirst();

    expect(get(codeSidebarTargets).get('node-1')).toBe(second);

    unregisterSecond();
    expect(get(codeSidebarTargets).size).toBe(0);
  });

  it('retains the selected and pinned target outside the tab component lifecycle', () => {
    codeSidebarSelection.set({
      activeTargetId: 'node-2',
      pinnedTargetId: 'node-2',
      lastSelectedNodeId: 'node-1',
      lastSelectedNodeTargetId: 'node-1'
    });

    expect(get(codeSidebarSelection)).toMatchObject({
      activeTargetId: 'node-2',
      pinnedTargetId: 'node-2'
    });
  });
});
