import { stripJavaScriptComments, stripJavaScriptStrings } from '$lib/utils/javascript-comments';

function stripCodeForIdentifierSearch(code: string) {
  return stripJavaScriptStrings(stripJavaScriptComments(code));
}

export function hasChuckAdcReference(code: string): boolean {
  return /\badc\b/.test(stripCodeForIdentifierSearch(code));
}

export function hasNoAudioInputDirective(code: string): boolean {
  return /\bnoAudioInput\s*\(/.test(stripCodeForIdentifierSearch(code));
}

export function shouldShowSimpleDspAudioInput(
  showAudioInput: boolean | undefined,
  code: string
): boolean {
  if (showAudioInput !== undefined) return showAudioInput;

  return !hasNoAudioInputDirective(code);
}
