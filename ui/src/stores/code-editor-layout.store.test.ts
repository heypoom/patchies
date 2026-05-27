import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';

import {
  activeCodeEditorTarget,
  closeCodeEditorOverlay,
  hasCodeEditorTargetSettings,
  isDetachedCodeEditorTarget,
  openCodeEditorOverlay,
  openCodeEditorSidebar,
  type CodeEditorTarget
} from './code-editor-layout.store';
import { sidebarVisibleTabs } from './sidebar-visibility.store';
import { isSidebarOpen, sidebarView } from './ui.store';

describe('code editor layout store', () => {
  it('tracks the active overlay target and clears it', () => {
    isSidebarOpen.set(true);

    openCodeEditorOverlay({
      nodeId: 'node-1',
      dataKey: 'code',
      language: 'javascript',
      nodeType: 'canvas',
      title: 'canvas'
    });

    expect(get(activeCodeEditorTarget)).toEqual({
      nodeId: 'node-1',
      dataKey: 'code',
      language: 'javascript',
      nodeType: 'canvas',
      title: 'canvas',
      mode: 'overlay'
    });
    expect(isDetachedCodeEditorTarget('node-1', 'code')).toBe(true);
    expect(isDetachedCodeEditorTarget('node-1', 'expr')).toBe(false);
    expect(get(isSidebarOpen)).toBe(false);

    closeCodeEditorOverlay();

    expect(get(activeCodeEditorTarget)).toBeNull();
    expect(isDetachedCodeEditorTarget('node-1', 'code')).toBe(false);
  });

  it('opens sidebar targets and activates the sidebar code view', () => {
    openCodeEditorSidebar({
      nodeId: 'node-2',
      dataKey: 'code',
      language: 'javascript',
      nodeType: 'hydra',
      title: 'hydra'
    });

    expect(get(activeCodeEditorTarget)).toEqual({
      nodeId: 'node-2',
      dataKey: 'code',
      language: 'javascript',
      nodeType: 'hydra',
      title: 'hydra',
      mode: 'sidebar'
    });
    expect(get(sidebarView)).toBe('code');
    expect(get(isSidebarOpen)).toBe(true);
    expect(get(sidebarVisibleTabs).has('code')).toBe(true);

    closeCodeEditorOverlay();
  });

  it('detects schema and custom settings targets', () => {
    const baseTarget = {
      nodeId: 'node-1',
      dataKey: 'code',
      language: 'javascript',
      mode: 'overlay'
    } satisfies CodeEditorTarget;

    expect(hasCodeEditorTargetSettings(baseTarget)).toBe(false);

    expect(
      hasCodeEditorTargetSettings({
        ...baseTarget,
        settings: {
          schema: [],
          values: {},
          onValueChange: () => {},
          onRevertAll: () => {}
        }
      })
    ).toBe(false);

    expect(
      hasCodeEditorTargetSettings({
        ...baseTarget,
        settings: {
          schema: [
            {
              key: 'size',
              label: 'Size',
              type: 'number',
              min: 1,
              max: 10,
              step: 1
            }
          ],
          values: {},
          onValueChange: () => {},
          onRevertAll: () => {}
        }
      })
    ).toBe(true);

    expect(
      hasCodeEditorTargetSettings({
        ...baseTarget,
        customSettings: (() => {}) as any
      })
    ).toBe(true);
  });
});
