import type { CookPolicy } from '$workers/rendering/CookStateManager';
import { createJavaScriptCookPolicy } from '$workers/rendering/cooking/javascript';

const TEXTMODE_TIME_PATTERN = /\bclock\s*\.\s*time\b/;

const TEXTMODE_FRAME_PATTERN =
  /\b(?:t|tm)\s*\.\s*frameCount\b|\b(?:osc|noise|voronoi|gradient|plasma|moire)\s*\(/;

export const createTextmodeCookPolicy = (code: string): CookPolicy =>
  createJavaScriptCookPolicy(code, {
    timePattern: TEXTMODE_TIME_PATTERN,
    framePattern: TEXTMODE_FRAME_PATTERN
  });
