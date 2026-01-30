/**
 * Extract canvas dimensions from createCanvas() call in p5.js code
 */
export function parseCanvasDimensions(code: string): { width: number; height: number } | null {
  const match = code.match(/createCanvas\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (!match) return null;

  return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
}
