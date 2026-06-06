import { StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  hoverTooltip,
  type DecorationSet,
  type Tooltip
} from '@codemirror/view';

export type InlineDecoration = {
  from: number;
  to: number;
  className: string;
  data?: string;
  hoverText?: string;
};

export const setInlineDecorationsEffect = StateEffect.define<InlineDecoration[] | null>();

const inlineDecorationMetadataField = StateField.define<InlineDecoration[]>({
  create() {
    return [];
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setInlineDecorationsEffect)) {
        return effect.value ?? [];
      }
    }

    if (!tr.docChanged) return decorations;

    return decorations.map((decoration) => ({
      ...decoration,
      from: tr.changes.mapPos(decoration.from),
      to: tr.changes.mapPos(decoration.to)
    }));
  }
});

const inlineDecorationField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tx) {
    decorations = decorations.map(tx.changes);

    for (const effect of tx.effects) {
      if (effect.is(setInlineDecorationsEffect)) {
        if (effect.value === null || effect.value.length === 0) {
          decorations = Decoration.none;
        } else {
          const decor = effect.value
            .filter(({ from, to }) => from < to && from >= 0 && to <= tx.state.doc.length)
            .map(({ from, to, className, data }) =>
              Decoration.mark({
                class: className,
                attributes: {
                  ...(data ? { 'data-inline-decoration': data } : {})
                }
              }).range(from, to)
            );

          decorations = Decoration.set(decor, true);
        }
      }
    }

    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f)
});

const inlineDecorationTooltip = hoverTooltip(
  (view, pos) => {
    const decoration = view.state
      .field(inlineDecorationMetadataField)
      .find(({ from, to, hoverText }) => hoverText && from <= pos && pos <= to);

    if (!decoration?.hoverText) return null;

    return {
      pos: decoration.from,
      end: decoration.to,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.className = 'cm-inline-decoration-tooltip';
        dom.textContent = decoration.hoverText ?? '';

        return { dom };
      }
    } satisfies Tooltip;
  },
  { hoverTime: 150 }
);

export const inlineDecorationExtensions: Extension[] = [
  inlineDecorationField,
  inlineDecorationMetadataField,
  inlineDecorationTooltip
];

export const inlineDecorationTheme = EditorView.theme({
  '.cm-inline-decoration-tooltip': {
    backgroundColor: 'rgb(39 39 42)',
    border: '1px solid rgb(63 63 70)',
    borderRadius: '4px',
    padding: '6px 10px',
    maxWidth: '320px',
    color: 'rgb(244 244 245)',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  }
});

export function getInlineDecorationTarget(event: Event) {
  const target = event.target instanceof Element ? event.target : null;

  return target?.closest('[data-inline-decoration]') ?? null;
}
