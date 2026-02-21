/**
 * Uiua syntax highlighting for preview mode.
 * Generates HTML with spans for syntax highlighting.
 * Based on syntax rules from array-box.
 */

import { match } from 'ts-pattern';

// Monadic functions (take 1 array argument) - cyan
const MONADIC_FUNCTIONS = new Set([
  '¬',
  '±',
  '√',
  '○',
  '⌵',
  '⌈',
  '⌊',
  '⧻',
  '△',
  '⇡',
  '⊢',
  '⇌',
  '♭',
  '¤',
  '⊚',
  '⊛',
  '◴',
  '⍏',
  '⍖',
  '⊝',
  'ℂ',
  '⁅',
  '⍉',
  '⋯',
  '⍘',
  '⚙',
  '⸮',
  '⬛',
  '□',
  '⊣',
  '∿',
  '⍆',
  '⧆',
  '⨪',
  'ₑ'
]);

// Dyadic functions (take 2 array arguments) - green
const DYADIC_FUNCTIONS = new Set([
  '+',
  '-',
  '×',
  '÷',
  '◿',
  'ⁿ',
  'ₙ',
  '=',
  '≠',
  '<',
  '>',
  '≤',
  '≥',
  '↧',
  '↥',
  '∠',
  '∨',
  '⊻',
  '⊼',
  '⊽',
  '⊂',
  '⊏',
  '⊡',
  '↯',
  '☇',
  '↙',
  '↘',
  '↻',
  '⊗',
  '∈',
  '⊟',
  '▽',
  '◫',
  '▩',
  '⤸',
  '◠',
  '≍',
  '⌕',
  '⦷',
  '⨂',
  '⊥'
]);

// 1-modifiers (take 1 function argument) - pink
const MONADIC_MODIFIERS = new Set([
  '˙',
  '˜',
  '⊙',
  '⋅',
  '⟜',
  '⊸',
  '⤙',
  '⤚',
  '◡',
  '∩',
  '≡',
  '⍚',
  '⊞',
  '⧅',
  '⧈',
  '⊕',
  '⊜',
  '/',
  '∧',
  '\\',
  '⍥',
  '⌅',
  '°',
  '⌝',
  '⧋',
  '◇',
  '∪'
]);

// 2-modifiers (take 2+ function arguments) - yellow
const DYADIC_MODIFIERS = new Set(['⊃', '⊓', '⍜', '⍢', '⬚', '⨬', '⍣']);

// Constants - purple (same as numbers)
const CONSTANTS = new Set(['η', 'π', 'τ', '∞']);

// Stack operations
const STACK_OPS = new Set(['∘', '◌', '?']);

// Subscript characters
const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₔₕₖₗₘₙₚₛₜ';

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

type TokenType =
  | 'monadic'
  | 'dyadic'
  | 'mod1'
  | 'mod2'
  | 'number'
  | 'string'
  | 'comment'
  | 'stack'
  | 'default';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let lastType: TokenType = 'default';

  while (i < code.length) {
    const remaining = code.substring(i);
    const char = code[i];

    // Whitespace
    if (/\s/.test(char)) {
      tokens.push({ type: 'default', value: char });
      i++;
      continue;
    }

    // Comments (# to end of line)
    if (char === '#') {
      const lineEnd = code.indexOf('\n', i);
      const end = lineEnd === -1 ? code.length : lineEnd;
      tokens.push({ type: 'comment', value: code.substring(i, end) });
      lastType = 'comment';
      i = end;
      continue;
    }

    // Strings ("...")
    if (char === '"') {
      let end = i + 1;
      while (end < code.length) {
        if (code[end] === '"') {
          end++;
          break;
        }
        if (code[end] === '\\') end++;
        end++;
      }
      tokens.push({ type: 'string', value: code.substring(i, end) });
      lastType = 'string';
      i = end;
      continue;
    }

    // Character literals (@x or @\n for escapes)
    if (char === '@') {
      let end = i + 1; // Start after '@'
      if (end < code.length) {
        if (code[end] === '\\') {
          end++; // Skip the backslash
          if (end < code.length) {
            end++; // Skip the escaped character
          }
        } else {
          end++; // Skip a single character
        }
      }
      tokens.push({ type: 'string', value: code.substring(i, end) });
      lastType = 'string';
      i = end;
      continue;
    }

    // Numbers (including negative with ¯)
    const numMatch = remaining.match(/^¯?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
    if (numMatch) {
      tokens.push({ type: 'number', value: numMatch[0] });
      lastType = 'number';
      i += numMatch[0].length;
      continue;
    }

    // Negative sign standalone
    if (char === '¯') {
      tokens.push({ type: 'number', value: char });
      lastType = 'number';
      i++;
      continue;
    }

    // Constants
    if (CONSTANTS.has(char)) {
      tokens.push({ type: 'number', value: char });
      lastType = 'number';
      i++;
      continue;
    }

    // Monadic functions
    if (MONADIC_FUNCTIONS.has(char)) {
      tokens.push({ type: 'monadic', value: char });
      lastType = 'monadic';
      i++;
      continue;
    }

    // Dyadic functions
    if (DYADIC_FUNCTIONS.has(char)) {
      tokens.push({ type: 'dyadic', value: char });
      lastType = 'dyadic';
      i++;
      continue;
    }

    // 1-modifiers
    if (MONADIC_MODIFIERS.has(char)) {
      tokens.push({ type: 'mod1', value: char });
      lastType = 'mod1';
      i++;
      continue;
    }

    // 2-modifiers
    if (DYADIC_MODIFIERS.has(char)) {
      tokens.push({ type: 'mod2', value: char });
      lastType = 'mod2';
      i++;
      continue;
    }

    // Stack operations
    if (STACK_OPS.has(char)) {
      tokens.push({ type: 'stack', value: char });
      lastType = 'stack';
      i++;
      continue;
    }

    // Subscripts inherit from previous (checked last so function chars like ₑ, ₙ match first)
    if (SUBSCRIPTS.includes(char)) {
      tokens.push({ type: lastType, value: char });
      i++;
      continue;
    }

    // Default
    tokens.push({ type: 'default', value: char });
    i++;
  }

  return tokens;
}

const getTokenClass = (type: TokenType): string | null =>
  match(type)
    .with('monadic', () => 'uiua-monadic')
    .with('dyadic', () => 'uiua-dyadic')
    .with('mod1', () => 'uiua-mod1')
    .with('mod2', () => 'uiua-mod2')
    .with('number', () => 'uiua-number')
    .with('string', () => 'uiua-string')
    .with('comment', () => 'uiua-comment')
    .with('stack', () => 'uiua-stack')
    .with('default', () => null)
    .exhaustive();

/**
 * Highlight Uiua code and return HTML string.
 */
/**
 * Check if a character is a Uiua glyph that has documentation
 */
function isUiuaGlyph(char: string): boolean {
  // Glyphs are single characters that are functions, modifiers, or stack ops
  return (
    MONADIC_FUNCTIONS.has(char) ||
    DYADIC_FUNCTIONS.has(char) ||
    MONADIC_MODIFIERS.has(char) ||
    DYADIC_MODIFIERS.has(char) ||
    STACK_OPS.has(char) ||
    CONSTANTS.has(char)
  );
}

/**
 * Highlight Uiua code and return HTML string.
 * Glyph spans include data-glyph attribute for tooltip support.
 */
export function highlightUiua(code: string): string {
  if (!code) return '';

  const tokens = tokenize(code);

  return tokens
    .map((token) => {
      const escaped = escapeHtml(token.value);
      const cls = getTokenClass(token.type);

      if (cls) {
        // Add data-glyph attribute for single-character glyphs
        if (token.value.length === 1 && isUiuaGlyph(token.value)) {
          return `<span class="${cls}" data-glyph="${escaped}">${escaped}</span>`;
        }

        return `<span class="${cls}">${escaped}</span>`;
      }
      return escaped;
    })
    .join('');
}
