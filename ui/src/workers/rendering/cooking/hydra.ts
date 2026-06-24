import type { CookPolicy } from '../CookStateManager';
import { detectJavaScriptCookDependencies } from './javascript';

const TIME_DEPENDENT_GENERATOR_PATTERN = /\b(?:osc|noise|voronoi|gradient)\s*\(/;
const TRANSPORT_TIME_PATTERN = /\b(?:clock\s*\.\s*)?time\b/;
const HYDRA_TIME_PATTERN = new RegExp(
  `${TIME_DEPENDENT_GENERATOR_PATTERN.source}|${TRANSPORT_TIME_PATTERN.source}`
);

const CONSERVATIVE_ALWAYS_PATTERN =
  /\b(?:datamosh|setFunction|setInterval|setTimeout|requestAnimationFrame)\b|\b(?:Math\.random|Date\.|performance\.now)\b/;

export function createHydraCookPolicy(code: string): CookPolicy {
  const dependencies = detectJavaScriptCookDependencies(code, {
    alwaysPattern: CONSERVATIVE_ALWAYS_PATTERN,
    timePattern: HYDRA_TIME_PATTERN
  });

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
