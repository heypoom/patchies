import { stripJavaScriptComments } from '$lib/utils/javascript-comments';

/**
 * Extract canvas dimensions from createCanvas() call in p5.js code
 */
export function parseCanvasDimensions(code: string): { width: number; height: number } | null {
  const match = code.match(/createCanvas\s*\(\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[^)]*)?\)/);
  if (!match) return null;

  return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
}

export const shouldResetP5CanvasSize = (code: string): boolean =>
  !/\bcreateCanvas\s*\(/.test(stripJavaScriptComments(code));
