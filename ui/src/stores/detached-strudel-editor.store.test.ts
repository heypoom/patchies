import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';

import {
  activeDetachedStrudelNodeId,
  closeDetachedStrudelEditor,
  isDetachedStrudelEditor,
  openDetachedStrudelEditor
} from './detached-strudel-editor.store';

describe('detached strudel editor store', () => {
  it('tracks the active detached strudel node', () => {
    openDetachedStrudelEditor('strudel-1');

    expect(get(activeDetachedStrudelNodeId)).toBe('strudel-1');
    expect(isDetachedStrudelEditor('strudel-1')).toBe(true);
    expect(isDetachedStrudelEditor('strudel-2')).toBe(false);

    closeDetachedStrudelEditor();

    expect(get(activeDetachedStrudelNodeId)).toBeNull();
    expect(isDetachedStrudelEditor('strudel-1')).toBe(false);
  });
});
