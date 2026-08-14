import { get } from 'svelte/store';
import { afterEach, describe, expect, it } from 'vitest';
import { settingsSidebarSelection } from './settings-sidebar.store';

afterEach(() => {
  settingsSidebarSelection.set({
    activeTargetId: null,
    pinnedTargetId: null,
    lastSelectedNodeId: null,
    lastSelectedNodeTargetId: null
  });
});

describe('settings sidebar selection', () => {
  it('retains the selected and pinned target outside the tab component lifecycle', () => {
    settingsSidebarSelection.set({
      activeTargetId: 'node-2',
      pinnedTargetId: 'node-2',
      lastSelectedNodeId: 'node-1',
      lastSelectedNodeTargetId: 'node-1'
    });

    expect(get(settingsSidebarSelection)).toMatchObject({
      activeTargetId: 'node-2',
      pinnedTargetId: 'node-2'
    });
  });
});
