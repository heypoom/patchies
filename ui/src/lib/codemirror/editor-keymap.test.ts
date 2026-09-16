import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { completionOrIndentKeymap } from '$lib/codemirror/editor-keymap';

describe('completionOrIndentKeymap', () => {
  it('indents the current line when Tab is pressed without an active completion', () => {
    let state = EditorState.create({
      doc: 'push 40',
      selection: { anchor: 7 }
    });
    const view = {
      get state() {
        return state;
      },
      dispatch(transaction: { state: EditorState }) {
        state = transaction.state;
      }
    } as unknown as EditorView;

    const tabBinding = completionOrIndentKeymap.find((binding) => binding.key === 'Tab');

    expect(tabBinding?.run?.(view)).toBe(true);
    expect(state.doc.toString()).toBe('  push 40');
  });
});
