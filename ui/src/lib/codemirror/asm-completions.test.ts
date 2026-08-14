import { CompletionContext } from '@codemirror/autocomplete';
import { insertNewlineAndIndent } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { assemblyLanguage } from '$lib/codemirror/assembly/assembly';
import { createAsmCompletionSource } from '$lib/codemirror/asm-completions';

function getCompletionLabels(doc: string) {
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, doc.length, true);
  const result = createAsmCompletionSource()(context);

  return result?.options.map((option) => option.label) ?? [];
}

function getCompletion(doc: string, label: string) {
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, doc.length, true);
  const completion = createAsmCompletionSource()(context)?.options.find(
    (option) => option.label === label
  );

  if (!completion) {
    throw new Error(`Missing asm completion: ${label}`);
  }

  return completion;
}

describe('asm completions', () => {
  it('suggests instructions and directives from the asm documentation', () => {
    expect(getCompletionLabels('ju')).toEqual(
      expect.arrayContaining(['jump', 'jump_zero', 'jump_not_zero'])
    );

    expect(getCompletionLabels('load_')).toEqual(['load_string']);
    expect(getCompletionLabels('.st')).toEqual(['.string']);
  });

  it('does not offer completions inside assembly comments', () => {
    expect(getCompletionLabels('; ju')).toEqual([]);
    expect(getCompletionLabels('push 1 ; lo')).toEqual([]);
  });

  it('inserts only the instruction keyword', () => {
    expect(getCompletion('pu', 'push')).not.toHaveProperty('apply');
    expect(getCompletion('.st', '.string')).not.toHaveProperty('apply');
  });

  it('does not indent the next instruction when Enter is pressed', () => {
    let state = EditorState.create({
      doc: 'push 40',
      selection: { anchor: 7 },
      extensions: [assemblyLanguage]
    });
    const view = {
      get state() {
        return state;
      },
      dispatch(transaction: { state: EditorState }) {
        state = transaction.state;
      }
    } as unknown as EditorView;

    expect(insertNewlineAndIndent(view)).toBe(true);
    expect(state.doc.toString()).toBe('push 40\n');
  });
});
