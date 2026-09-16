import { acceptCompletion, completionStatus } from '@codemirror/autocomplete';
import { indentMore } from '@codemirror/commands';
import type { KeyBinding } from '@codemirror/view';

export const completionOrIndentKeymap: readonly KeyBinding[] = [
  {
    key: 'Tab',
    run: (view) => {
      if (completionStatus(view.state) === 'active') {
        return acceptCompletion(view);
      }

      return indentMore(view);
    }
  }
];
