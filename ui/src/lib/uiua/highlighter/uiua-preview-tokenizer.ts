/**
 * Uiua tokenizer for preview mode syntax highlighting.
 * Generates an array of tokens from Uiua code.
 */

import {
  MONADIC_FUNCTIONS,
  DYADIC_FUNCTIONS,
  MONADIC_MODIFIERS,
  DYADIC_MODIFIERS,
  CONSTANTS,
  STACK_OPS,
  SUBSCRIPTS
} from './uiua-tokenizer-glyphs';

export type TokenType =
  | 'monadic'
  | 'dyadic'
  | 'mod1'
  | 'mod2'
  | 'number'
  | 'string'
  | 'comment'
  | 'stack'
  | 'default';

export interface Token {
  type: TokenType;
  value: string;
}

/**
 * Tokenize Uiua code into an array of tokens.
 */
export function tokenize(code: string): Token[] {
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
