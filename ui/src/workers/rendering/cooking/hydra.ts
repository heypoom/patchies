import { stripJavaScriptComments, stripJavaScriptStrings } from '$lib/utils/javascript-comments';
import type { CookPolicy } from '../CookStateManager';

const TIME_DEPENDENT_GENERATOR_PATTERN = /\b(?:osc|noise|voronoi|gradient)\s*\(/;
const TRANSPORT_TIME_PATTERN = /\b(?:clock\s*\.\s*)?time\b/;
const MOUSE_PATTERN = /\bmouse\b/;
const FFT_PATTERN = /\bfft\s*\(/;

const CONSERVATIVE_ALWAYS_PATTERN =
  /\b(?:datamosh|setFunction|setInterval|setTimeout|requestAnimationFrame)\b|\b(?:Math\.random|Date\.|performance\.now)\b/;

export function createHydraCookPolicy(code: string): CookPolicy {
  const source = stripJavaScriptStrings(stripJavaScriptComments(code));

  if (CONSERVATIVE_ALWAYS_PATTERN.test(source)) {
    return { mode: 'always' };
  }

  const isTimeDependent =
    TIME_DEPENDENT_GENERATOR_PATTERN.test(source) || TRANSPORT_TIME_PATTERN.test(source);

  return {
    mode: 'on-demand',

    ...(isTimeDependent ? { timeDependent: true } : {}),
    ...(MOUSE_PATTERN.test(source) ? { mouseDependent: true } : {}),
    ...(FFT_PATTERN.test(source) ? { fftDependent: true } : {})
  };
}
