import { stripJavaScriptComments, stripJavaScriptStrings } from '$lib/utils/javascript-comments';

export type SimpleDspAudioInputNodeType = 'tone~' | 'sonic~' | 'elem~';

const stripCodeForIdentifierSearch = (code: string) =>
  stripJavaScriptStrings(stripJavaScriptComments(code));

export const hasChuckAdcReference = (code: string): boolean =>
  /\badc\b/.test(stripCodeForIdentifierSearch(code));

export const hasShowAudioInputDirective = (code: string): boolean =>
  /\bshowAudioInput\s*\(/.test(stripCodeForIdentifierSearch(code));

const hasInputNodeReference = (code: string): boolean =>
  /\binputNode\b/.test(stripCodeForIdentifierSearch(code));

const hasElementaryInputReference = (code: string): boolean =>
  /\bel\s*\.\s*in\s*\(/.test(stripCodeForIdentifierSearch(code));

export function hasAudioInputUsage(nodeType: SimpleDspAudioInputNodeType, code: string): boolean {
  if (hasShowAudioInputDirective(code)) return true;

  if (nodeType === 'elem~') {
    return hasInputNodeReference(code) || hasElementaryInputReference(code);
  }

  return hasInputNodeReference(code);
}

export function getInitialSimpleDspAudioInputVisibility(
  nodeType: SimpleDspAudioInputNodeType,
  showAudioInput: boolean | undefined,
  code: string
): boolean {
  if (hasAudioInputUsage(nodeType, code)) return true;
  if (showAudioInput !== undefined) return showAudioInput;

  return false;
}
