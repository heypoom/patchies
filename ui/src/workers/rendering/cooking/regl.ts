import type { CookPolicy } from '../CookStateManager';

import { createJavaScriptCookPolicy } from './javascript';

export const createReglCookPolicy = (code: string): CookPolicy =>
  createJavaScriptCookPolicy(code, { ignoreFunctionParameterNames: ['render'] });
