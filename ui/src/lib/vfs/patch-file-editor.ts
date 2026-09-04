import type { SupportedLanguage } from '$lib/codemirror/types';

const PATCH_GLSL_PATTERN = /^patch:\/\/.+\.(?:gl|glsl|frag|vert|glslf|glslv)$/;
const PATCH_JAVASCRIPT_PATTERN = /^patch:\/\/.+\.(?:js|mjs)$/;

export const isEditablePatchJavaScriptPath = (path: string): boolean =>
  PATCH_JAVASCRIPT_PATTERN.test(path);

export const isEditablePatchCodePath = (path: string): boolean =>
  PATCH_GLSL_PATTERN.test(path) || isEditablePatchJavaScriptPath(path);

export const getPatchFileEditorLanguage = (path: string): SupportedLanguage =>
  isEditablePatchJavaScriptPath(path) ? 'javascript' : 'glsl';
