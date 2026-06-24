import { stripJavaScriptComments } from '$lib/utils/javascript-comments';
import type { ShaderParkRenderMode } from '$lib/rendering/types';
import type { CookPolicy } from '../CookStateManager';

const TIME_PATTERN = /\btime\b/;
const MOUSE_PATTERN = /\bmouse\b|\bmouseIntersection\b/;

export function createShaderParkCookPolicy(
  code: string,
  options: { renderMode?: ShaderParkRenderMode } = {}
): CookPolicy {
  const source = stripJavaScriptComments(code);
  const isMouseDependent = options.renderMode === '3d' || MOUSE_PATTERN.test(source);

  return {
    mode: 'on-demand',
    ...(TIME_PATTERN.test(source) ? { timeDependent: true } : {}),
    ...(isMouseDependent ? { mouseDependent: true } : {})
  };
}
