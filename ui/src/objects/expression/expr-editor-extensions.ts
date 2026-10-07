import { EditorView, keymap } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

export const createExprEditorExtensions = (
  cancel: () => void,
  blur: () => void,
  extraExtensions: Extension[]
): Extension[] => [
  keymap.of(
    ['Escape', 'Mod-.'].map((key) => ({
      key,
      run: () => {
        cancel();

        return true;
      }
    }))
  ),
  EditorView.focusChangeEffect.of((_, focusing) => {
    if (!focusing) blur();

    return null;
  }),
  ...extraExtensions
];
