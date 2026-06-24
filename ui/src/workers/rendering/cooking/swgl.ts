import { stripJavaScriptComments } from '$lib/utils/javascript-comments';
import type { CookPolicy } from '../CookStateManager';

const TIME_PATTERN = /\bt\b/;

export function createSwglCookPolicy(code: string): CookPolicy {
  const source = stripJavaScriptComments(code);

  return {
    mode: 'on-demand',
    ...(TIME_PATTERN.test(source) ? { timeDependent: true } : {})
  };
}
