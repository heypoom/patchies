import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';

import {
  activeDetachedOrcaNodeId,
  closeDetachedOrcaEditor,
  isDetachedOrcaEditor,
  openDetachedOrcaEditor
} from './detached-orca-editor.store';

describe('detached orca editor store', () => {
  it('tracks the active detached orca node', () => {
    openDetachedOrcaEditor('orca-1');

    expect(get(activeDetachedOrcaNodeId)).toBe('orca-1');
    expect(isDetachedOrcaEditor('orca-1')).toBe(true);
    expect(isDetachedOrcaEditor('orca-2')).toBe(false);

    closeDetachedOrcaEditor();

    expect(get(activeDetachedOrcaNodeId)).toBeNull();
    expect(isDetachedOrcaEditor('orca-1')).toBe(false);
  });
});
