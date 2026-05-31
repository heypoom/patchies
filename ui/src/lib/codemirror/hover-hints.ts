import type { Completion } from '@codemirror/autocomplete';
import { EditorState, type Extension } from '@codemirror/state';
import { hoverTooltip, type Tooltip } from '@codemirror/view';
import { match } from 'ts-pattern';
import { isCompletionSuppressedByComment } from '$lib/codemirror/completion-utils';
import {
  isGlslInJavaScriptCompletionContext,
  isJavaScriptStringCompletionContext
} from '$lib/codemirror/glsl-in-js';
import { getGlslCompletionByLabel } from '$lib/codemirror/glsl-completions';
import {
  getPatchiesCompletionByLabel,
  type PatchiesContext
} from '$lib/codemirror/patchies-completions';
import { getHydraCompletionByLabel } from '$lib/codemirror/hydra-completions';
import { getShaderParkCompletionByLabel } from '$lib/codemirror/shaderpark-completions';
import { getPeppermintCompletionByLabel } from '$lib/codemirror/peppermint.codemirror';
import type { SupportedLanguage } from '$lib/codemirror/types';

export interface CompletionHoverContext extends PatchiesContext {
  language?: SupportedLanguage | string;
}

export interface CompletionHoverHint {
  from: number;
  to: number;
  completion: Completion;
}

const WORD_CHAR = /[A-Za-z0-9_$]/;

function getWordAt(
  state: EditorState,
  pos: number
): { from: number; to: number; text: string } | null {
  const line = state.doc.lineAt(pos);

  let from = pos;
  let to = pos;

  while (from > line.from && WORD_CHAR.test(line.text[from - line.from - 1])) {
    from--;
  }

  while (to < line.to && WORD_CHAR.test(line.text[to - line.from])) {
    to++;
  }

  if (from === to) return null;

  return {
    from,
    to,
    text: state.doc.sliceString(from, to)
  };
}

const createCompletionContext = (state: EditorState, pos: number) =>
  ({ state, pos }) as Parameters<typeof isJavaScriptStringCompletionContext>[0];

function getCompletionForWord(
  word: string,
  state: EditorState,
  pos: number,
  context: CompletionHoverContext
): Completion | undefined {
  return match(context.language)
    .with('glsl', () => getGlslCompletionByLabel(word))
    .with('peppermint', () => getPeppermintCompletionByLabel(word))
    .with('javascript', () => {
      const completionContext = createCompletionContext(state, pos);

      if (isGlslInJavaScriptCompletionContext(completionContext)) {
        return getGlslCompletionByLabel(word);
      }

      if (isJavaScriptStringCompletionContext(completionContext)) {
        return;
      }

      if (context.nodeType === 'shaderpark') {
        return getShaderParkCompletionByLabel(word);
      }

      if (context.nodeType === 'hydra') {
        return getHydraCompletionByLabel(word) ?? getPatchiesCompletionByLabel(word, context);
      }

      return getPatchiesCompletionByLabel(word, context);
    })
    .otherwise(() => undefined);
}

export function getCompletionHoverHint(
  state: EditorState,
  pos: number,
  hoverCtx: CompletionHoverContext
): CompletionHoverHint | null {
  const word = getWordAt(state, pos);
  if (!word) return null;

  const completionCtx = createCompletionContext(state, pos);

  if (isCompletionSuppressedByComment(completionCtx, word.from)) {
    return null;
  }

  const completion = getCompletionForWord(word.text, state, pos, hoverCtx);
  if (!completion) return null;

  return {
    from: word.from,
    to: word.to,
    completion
  };
}

function appendTooltipLine(dom: HTMLElement, className: string, text: unknown) {
  if (typeof text !== 'string' || text.length === 0) return;

  const line = document.createElement('div');
  line.className = className;
  line.textContent = text;

  dom.appendChild(line);
}

function createCompletionHintDom(completion: Completion) {
  const dom = document.createElement('div');
  dom.className = 'cm-completion-hover';

  appendTooltipLine(dom, 'cm-completion-hover-label', completion.label);
  appendTooltipLine(dom, 'cm-completion-hover-detail', completion.detail);
  appendTooltipLine(dom, 'cm-completion-hover-info', completion.info);

  return dom;
}

export const completionHoverHints = (context: CompletionHoverContext = {}): Extension =>
  hoverTooltip(
    (view, pos, side) => {
      const hint = getCompletionHoverHint(view.state, pos, context);
      if (!hint) return null;

      if ((hint.from === pos && side < 0) || (hint.to === pos && side > 0)) {
        return null;
      }

      return {
        pos: hint.from,
        end: hint.to,
        above: true,
        create: () => ({ dom: createCompletionHintDom(hint.completion) })
      } satisfies Tooltip;
    },
    { hoverTime: 250 }
  );
