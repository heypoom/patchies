import { stripJavaScriptComments, stripJavaScriptStrings } from '$lib/utils/javascript-comments';

import type { CookPolicy } from '../CookStateManager';

const TIME_PATTERN = /\bt\b/;
const FFT_PATTERN = /\bfft\s*\(/;

export function createSwglCookPolicy(code: string): CookPolicy {
  const source = stripJavaScriptComments(code);
  const dependencySource = stripJavaScriptStrings(source);

  return {
    mode: 'on-demand',
    ...(TIME_PATTERN.test(source) ? { timeDependent: true } : {}),
    ...(FFT_PATTERN.test(dependencySource) ? { fftDependent: true } : {})
  };
}
