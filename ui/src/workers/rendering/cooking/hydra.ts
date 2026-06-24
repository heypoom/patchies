import { stripJavaScriptComments } from '$lib/utils/javascript-comments';
import type { CookPolicy } from '../CookStateManager';

const TIME_DEPENDENT_GENERATOR_PATTERN = /\b(?:osc|noise|voronoi|gradient)\s*\(/;
const MOUSE_PATTERN = /\bmouse\b/;
const FFT_PATTERN = /\bfft\s*\(/;

const CONSERVATIVE_ALWAYS_PATTERN =
  /\b(?:datamosh|setFunction|setInterval|setTimeout|requestAnimationFrame)\b|\b(?:Math\.random|Date\.|performance\.now)\b/;

export function createHydraCookPolicy(code: string): CookPolicy {
  const source = stripStrings(stripJavaScriptComments(code));

  if (CONSERVATIVE_ALWAYS_PATTERN.test(source)) {
    return { mode: 'always' };
  }

  return {
    mode: 'on-demand',
    ...(TIME_DEPENDENT_GENERATOR_PATTERN.test(source) ? { timeDependent: true } : {}),
    ...(MOUSE_PATTERN.test(source) ? { mouseDependent: true } : {}),
    ...(FFT_PATTERN.test(source) ? { fftDependent: true } : {})
  };
}

function stripStrings(code: string): string {
  let output = '';
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (let index = 0; index < code.length; index += 1) {
    const char = code[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }

      output += char === '\n' ? '\n' : ' ';

      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      output += ' ';

      continue;
    }

    output += char;
  }

  return output;
}
