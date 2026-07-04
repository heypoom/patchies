import type { CookPolicy } from '$workers/rendering/CookStateManager';

import { createJavaScriptCookPolicy } from '$workers/rendering/cooking/javascript';

export const createReglCookPolicy = (code: string): CookPolicy =>
  createJavaScriptCookPolicy(code, { ignoreFunctionParameterNames: ['render'] });
