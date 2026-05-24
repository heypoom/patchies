import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';

import {
  activeCodeEditorTarget,
  closeCodeEditorOverlay,
  isDetachedCodeEditorTarget,
  openCodeEditorOverlay
} from './code-editor-layout.store';

describe('code editor layout store', () => {
  it('tracks the active overlay target and clears it', () => {
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

    closeCodeEditorOverlay();

    expect(get(activeCodeEditorTarget)).toBeNull();
    expect(isDetachedCodeEditorTarget('node-1', 'code')).toBe(false);
  });
});
