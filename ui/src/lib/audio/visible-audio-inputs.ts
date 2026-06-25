import { stripJavaScriptComments, stripJavaScriptStrings } from '$lib/utils/javascript-comments';

const stripCodeForIdentifierSearch = (code: string) =>
  stripJavaScriptStrings(stripJavaScriptComments(code));

export const hasChuckAdcReference = (code: string): boolean =>
  /\badc\b/.test(stripCodeForIdentifierSearch(code));

export const hasNoAudioInputDirective = (code: string): boolean =>
  /\bnoAudioInput\s*\(/.test(stripCodeForIdentifierSearch(code));

export function getInitialSimpleDspAudioInputVisibility(
  showAudioInput: boolean | undefined,
  code: string
): boolean {
  if (showAudioInput !== undefined) return showAudioInput;

  return getRunSimpleDspAudioInputVisibility(code);
}

export const getRunSimpleDspAudioInputVisibility = (code: string): boolean =>
  !hasNoAudioInputDirective(code);
