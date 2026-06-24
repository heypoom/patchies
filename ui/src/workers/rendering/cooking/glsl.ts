import type { CookPolicy } from '../CookStateManager';

const TIME_PATTERN = /\biTime\b|\biTimeDelta\b/;
const FRAME_PATTERN = /\biFrame\b/;
const DATE_PATTERN = /\biDate\b/;
const MOUSE_PATTERN = /\biMouse\b/;

export function createGlslCookPolicy(code: string): CookPolicy {
  const source = stripGlslComments(code);

  return {
    mode: 'on-demand',
    ...(TIME_PATTERN.test(source) ? { timeDependent: true } : {}),
    ...(FRAME_PATTERN.test(source) ? { frameDependent: true } : {}),
    ...(DATE_PATTERN.test(source) ? { dateDependent: true } : {}),
    ...(MOUSE_PATTERN.test(source) ? { mouseDependent: true } : {})
  };
}

const stripGlslComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
