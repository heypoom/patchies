import { stripJavaScriptComments, stripJavaScriptStrings } from '$lib/utils/javascript-comments';

export interface JavaScriptCookDependencies {
  always?: boolean;
  timeDependent?: boolean;
  mouseDependent?: boolean;
  fftDependent?: boolean;
}

interface DetectJavaScriptCookDependenciesOptions {
  alwaysPattern?: RegExp;
  timePattern?: RegExp;
  mousePattern?: RegExp;
  fftPattern?: RegExp;
}

const ALWAYS_PATTERN =
  /\b(?:setInterval|setTimeout|requestAnimationFrame)\b|\b(?:Math\.random|Date\.|performance\.now)\b/;

const TIME_PATTERN = /\b(?:clock\s*\.\s*)?time\b/;
const MOUSE_PATTERN = /\bmouse\b/;
const FFT_PATTERN = /\bfft\s*\(/;

export function detectJavaScriptCookDependencies(
  code: string,
  options: DetectJavaScriptCookDependenciesOptions = {}
): JavaScriptCookDependencies {
  const source = stripJavaScriptStrings(stripJavaScriptComments(code));
  const alwaysPattern = options.alwaysPattern ?? ALWAYS_PATTERN;

  if (alwaysPattern.test(source)) {
    return { always: true };
  }

  const timePattern = options.timePattern ?? TIME_PATTERN;
  const mousePattern = options.mousePattern ?? MOUSE_PATTERN;
  const fftPattern = options.fftPattern ?? FFT_PATTERN;

  return {
    ...(timePattern.test(source) ? { timeDependent: true } : {}),
    ...(mousePattern.test(source) ? { mouseDependent: true } : {}),
    ...(fftPattern.test(source) ? { fftDependent: true } : {})
  };
}
