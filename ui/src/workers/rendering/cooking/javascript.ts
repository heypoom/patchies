import { stripJavaScriptComments, stripJavaScriptStrings } from '$lib/utils/javascript-comments';
import type { CookPolicy } from '../CookStateManager';

export interface JavaScriptCookDependencies {
  always?: boolean;
  timeDependent?: boolean;
  frameDependent?: boolean;
  mouseDependent?: boolean;
  fftDependent?: boolean;
}

interface DetectJavaScriptCookDependenciesOptions {
  alwaysPattern?: RegExp;
  timePattern?: RegExp;
  framePattern?: RegExp;
  mousePattern?: RegExp;
  fftPattern?: RegExp;
  ignoreFunctionParameterNames?: string[];
}

const ALWAYS_PATTERN =
  /\b(?:setInterval|setTimeout|requestAnimationFrame)\b|\b(?:Math\.random|Date\.|performance\.now)\b/;

const TIME_PATTERN = /\b(?:clock\s*\.\s*)?time\b/;
const MOUSE_PATTERN = /\bmouse\b/;
const FFT_PATTERN = /\bfft\s*\(/;

function stripNamedFunctionParameters(source: string, functionNames: string[]): string {
  if (functionNames.length === 0) return source;

  const names = functionNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

  const declarationPattern = new RegExp(`\\bfunction\\s+(?:${names})\\s*\\(([^)]*)\\)`, 'g');

  const assignmentPattern = new RegExp(
    `\\b(?:${names})\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*=>`,
    'g'
  );

  return source
    .replace(declarationPattern, (match, params: string) =>
      match.replace(params, ' '.repeat(params.length))
    )
    .replace(assignmentPattern, (match, params: string) =>
      match.replace(params, ' '.repeat(params.length))
    );
}

export function detectJavaScriptCookDependencies(
  code: string,
  options: DetectJavaScriptCookDependenciesOptions = {}
): JavaScriptCookDependencies {
  const source = stripNamedFunctionParameters(
    stripJavaScriptStrings(stripJavaScriptComments(code)),
    options.ignoreFunctionParameterNames ?? []
  );

  const alwaysPattern = options.alwaysPattern ?? ALWAYS_PATTERN;
  if (alwaysPattern.test(source)) return { always: true };

  const timePattern = options.timePattern ?? TIME_PATTERN;
  const framePattern = options.framePattern;
  const mousePattern = options.mousePattern ?? MOUSE_PATTERN;
  const fftPattern = options.fftPattern ?? FFT_PATTERN;

  return {
    ...(timePattern.test(source) ? { timeDependent: true } : {}),
    ...(framePattern?.test(source) ? { frameDependent: true } : {}),
    ...(mousePattern.test(source) ? { mouseDependent: true } : {}),
    ...(fftPattern.test(source) ? { fftDependent: true } : {})
  };
}

export function createJavaScriptCookPolicy(
  code: string,
  options: DetectJavaScriptCookDependenciesOptions = {}
): CookPolicy {
  const dependencies = detectJavaScriptCookDependencies(code, options);

  if (dependencies.always) {
    return { mode: 'always' };
  }

  return {
    mode: 'on-demand',
    ...(dependencies.timeDependent ? { timeDependent: true } : {}),
    ...(dependencies.frameDependent ? { frameDependent: true } : {}),
    ...(dependencies.mouseDependent ? { mouseDependent: true } : {}),
    ...(dependencies.fftDependent ? { fftDependent: true } : {})
  };
}
