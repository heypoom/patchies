import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import {
  createPatchiesCompletionSource,
  shouldShowPatchiesCompletions
} from '$lib/codemirror/patchies-completions';

function getCompletionLabels(nodeType: string, doc: string) {
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, doc.length, true);
  const result = createPatchiesCompletionSource({ nodeType })(context);

  return result?.options.map((option) => option.label) ?? [];
}

describe('patchies completions', () => {
  it('does not show Patchies API completions for shaderpark code', () => {
    expect(shouldShowPatchiesCompletions({ nodeType: 'shaderpark' })).toBe(false);
    expect(createPatchiesCompletionSource({ nodeType: 'shaderpark' })).toBeDefined();
    expect(getCompletionLabels('shaderpark', 'se')).toEqual([]);
    expect(getCompletionLabels('shaderpark', 'settings.')).toEqual([]);
  });

  it('still shows Patchies API completions for Patchies JavaScript contexts', () => {
    expect(shouldShowPatchiesCompletions({ nodeType: 'js' })).toBe(true);
    expect(getCompletionLabels('js', 'se')).toContain('send');
    expect(getCompletionLabels('js', 'settings.')).toContain('define');
  });
});
