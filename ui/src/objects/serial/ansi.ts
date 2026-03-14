export interface AnsiSpan {
  text: string;

  style: {
    color?: string;
    fontWeight?: string;
    textDecoration?: string;
  };
}

/** Maps ANSI SGR color codes to Zinc-palette-friendly hex colors */
const COLOR_MAP: Record<number, string> = {
  // Standard colors
  30: '#3f3f46', // black → zinc-700
  31: '#fb7185', // red → rose-400
  32: '#34d399', // green → emerald-400
  33: '#fbbf24', // yellow → amber-400
  34: '#60a5fa', // blue → blue-400
  35: '#c084fc', // magenta → purple-400
  36: '#22d3ee', // cyan → cyan-400
  37: '#f4f4f5', // white → zinc-100

  // Bright colors
  90: '#71717a', // bright black → zinc-500
  91: '#f43f5e', // bright red → rose-500
  92: '#10b981', // bright green → emerald-500
  93: '#f59e0b', // bright yellow → amber-500
  94: '#3b82f6', // bright blue → blue-500
  95: '#a855f7', // bright magenta → purple-500
  96: '#06b6d4', // bright cyan → cyan-500
  97: '#ffffff' // bright white
};

/**
 * Parse a string containing ANSI SGR escape codes into styled spans.
 * Supports: reset (0), bold (1), underline (4), standard colors (30-37), bright colors (90-97).
 */
export function parseAnsi(text: string): AnsiSpan[] {
  if (!text) return [];

  // eslint-disable-next-line no-control-regex
  const parts = text.split(/(\x1B\[[0-9;]*m)/g);
  const spans: AnsiSpan[] = [];

  let currentStyle: AnsiSpan['style'] = {};

  for (const part of parts) {
    if (part.startsWith('\x1B[')) {
      const codes = part.substring(2, part.length - 1).split(';');
      for (const code of codes) {
        const n = parseInt(code) || 0;
        if (n === 0) {
          currentStyle = {};
        } else if (n === 1) {
          currentStyle = { ...currentStyle, fontWeight: 'bold' };
        } else if (n === 4) {
          currentStyle = { ...currentStyle, textDecoration: 'underline' };
        } else if (COLOR_MAP[n]) {
          currentStyle = { ...currentStyle, color: COLOR_MAP[n] };
        }
      }
    } else if (part) {
      spans.push({ text: part, style: { ...currentStyle } });
    }
  }

  return spans;
}
