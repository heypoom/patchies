import type { CookPolicy } from '../CookStateManager';
import { detectJavaScriptCookDependencies } from './javascript';

export function createCanvasCookPolicy(code: string): CookPolicy {
  const dependencies = detectJavaScriptCookDependencies(code);

  if (dependencies.always) {
    return { mode: 'always' };
  }

  return {
    mode: 'on-demand',
    ...(dependencies.timeDependent ? { timeDependent: true } : {}),
    ...(dependencies.mouseDependent ? { mouseDependent: true } : {}),
    ...(dependencies.fftDependent ? { fftDependent: true } : {})
  };
}
