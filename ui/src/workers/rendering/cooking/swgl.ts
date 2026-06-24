import { stripJavaScriptComments } from '$lib/utils/javascript-comments';

import type { CookPolicy } from '../CookStateManager';
import { detectJavaScriptCookDependencies } from './javascript';

const TIME_PATTERN = /\bt\b/;
const NEVER_PATTERN = /$^/;

export function createSwglCookPolicy(code: string): CookPolicy {
  const source = stripJavaScriptComments(code);
  const dependencies = detectJavaScriptCookDependencies(code, { timePattern: NEVER_PATTERN });

  if (dependencies.always) {
    return { mode: 'always' };
  }

  return {
    mode: 'on-demand',
    ...(TIME_PATTERN.test(source) ? { timeDependent: true } : {}),
    ...(dependencies.mouseDependent ? { mouseDependent: true } : {}),
    ...(dependencies.fftDependent ? { fftDependent: true } : {})
  };
}
