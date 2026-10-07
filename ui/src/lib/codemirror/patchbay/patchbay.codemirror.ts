import {
  HighlightStyle,
  LanguageSupport,
  StreamLanguage,
  syntaxHighlighting
} from '@codemirror/language';
import type { CompletionContext } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';
import {
  patchbayParser,
  patchbaySectionCompletions,
  patchbayContextualCompletions,
  type PatchbayCompletionData
} from './patchbay-editor-model';
export * from './patchbay-editor-model';

export const patchbayLanguage = StreamLanguage.define(patchbayParser);

export function patchbayContextualCompletionSource(
  getData: () => PatchbayCompletionData
): Extension {
  return patchbayLanguage.data.of({
    autocomplete: (context: CompletionContext) => patchbayContextualCompletions(context, getData())
  });
}

const patchbayHighlightStyle = HighlightStyle.define([
  { tag: tags.typeName, color: '#7dcfff' },
  { tag: tags.keyword, color: '#bb9af7' },
  { tag: tags.operator, color: '#ff9e64' },
  { tag: tags.variableName, color: '#c0caf5' },
  { tag: tags.comment, color: '#565f89' }
]);

export function patchbay(): LanguageSupport {
  return new LanguageSupport(patchbayLanguage, [
    patchbayLanguage.data.of({ autocomplete: patchbaySectionCompletions }),
    syntaxHighlighting(patchbayHighlightStyle)
  ]);
}
