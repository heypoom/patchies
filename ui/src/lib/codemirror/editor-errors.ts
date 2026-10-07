import { StateField, StateEffect } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  hoverTooltip,
  type DecorationSet,
  type Tooltip
} from '@codemirror/view';

// Effect to set error lines (supports multiple lines)
export const setErrorLinesEffect = StateEffect.define<number[] | null>();

// Effect to set line errors with messages
export const setLineErrorsEffect = StateEffect.define<Record<number, string[]> | null>();

// StateField to store line errors for tooltip lookup
export const lineErrorsField = StateField.define<Record<number, string[]>>({
  create() {
    return {};
  },
  update(errors, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setLineErrorsEffect)) {
        return effect.value ?? {};
      }
    }
    return errors;
  }
});

// StateField to manage error line decorations
export const errorLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setErrorLinesEffect)) {
        if (effect.value === null || effect.value.length === 0) {
          decorations = Decoration.none;
        } else {
          const decoration = Decoration.line({ class: 'cm-errorLine' });
          const ranges = effect.value
            .filter((lineNum) => lineNum > 0 && lineNum <= tr.state.doc.lines)
            .map((lineNum) => decoration.range(tr.state.doc.line(lineNum).from));
          decorations = Decoration.set(ranges, true);
        }
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f)
});

// Create hover tooltip for error lines
export const errorTooltip = hoverTooltip(
  (view, pos) => {
    // Get the line at this position
    const line = view.state.doc.lineAt(pos);
    const lineNum = line.number;

    // Check if this line has errors
    const lineErrors = view.state.field(lineErrorsField);
    const errors = lineErrors[lineNum];

    if (!errors || errors.length === 0) return null;

    return {
      pos: line.from,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.className = 'cm-error-tooltip';

        errors.forEach((msg) => {
          const msgEl = document.createElement('div');
          msgEl.className = 'cm-error-tooltip-message';
          msgEl.textContent = msg;
          dom.appendChild(msgEl);
        });

        return { dom };
      }
    } satisfies Tooltip;
  },
  { hoverTime: 100 }
);
