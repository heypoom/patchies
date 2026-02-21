/**
 * Uiua tokenizer for CodeMirror StreamLanguage.
 * Processes one token at a time from a stream.
 */

import type { StringStream } from '@codemirror/language';
import {
  MONADIC_FUNCTIONS,
  DYADIC_FUNCTIONS,
  MONADIC_MODIFIERS,
  DYADIC_MODIFIERS,
  CONSTANTS,
  STACK_OPS,
  SUBSCRIPTS
} from './uiua-tokenizer-glyphs';

export interface UiuaState {
  lastTokenType: string | null;
}

export function tokenize(stream: StringStream, state: UiuaState): string | null {
  // Skip whitespace
  if (stream.eatSpace()) {
    return null;
  }

  // Comments (# to end of line)
  if (stream.match('#')) {
    stream.skipToEnd();
    state.lastTokenType = 'comment';

    return 'comment';
  }

  // Strings ("...")
  if (stream.match('"')) {
    while (!stream.eol()) {
      const ch = stream.next();
      if (ch === '"') break;
      if (ch === '\\') stream.next(); // Skip escaped char
    }

    state.lastTokenType = 'string';

    return 'string';
  }

  // Character literals (@x or @\n for escapes)
  if (stream.match('@')) {
    if (!stream.eol()) {
      if (stream.peek() === '\\') {
        stream.next(); // Consume the backslash

        if (!stream.eol()) {
          stream.next(); // Consume the escaped character
        }
      } else {
        stream.next(); // Consume a single character
      }
    }

    state.lastTokenType = 'string';
    return 'string';
  }

  // Numbers (including negative with ¯)
  if (stream.match(/^¯?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i)) {
    state.lastTokenType = 'number';
    return 'number';
  }

  // Single character tokens
  const char = stream.next();
  if (!char) return null;

  // Negative sign as constant (when not followed by number)
  if (char === '¯') {
    state.lastTokenType = 'number';
    return 'number';
  }

  // Constants (π, τ, η, ∞)
  if (CONSTANTS.has(char)) {
    state.lastTokenType = 'number';
    return 'number';
  }

  // Monadic functions
  if (MONADIC_FUNCTIONS.has(char)) {
    state.lastTokenType = 'keyword';
    return 'keyword'; // cyan - monadic functions
  }

  // Dyadic functions
  if (DYADIC_FUNCTIONS.has(char)) {
    state.lastTokenType = 'variableName';
    return 'variableName'; // green - dyadic functions
  }

  // 1-modifiers
  if (MONADIC_MODIFIERS.has(char)) {
    state.lastTokenType = 'propertyName';
    return 'propertyName'; // pink/magenta - 1-modifiers
  }

  // 2-modifiers
  if (DYADIC_MODIFIERS.has(char)) {
    state.lastTokenType = 'typeName';
    return 'typeName'; // yellow - 2-modifiers
  }

  // Stack operations
  if (STACK_OPS.has(char)) {
    state.lastTokenType = 'operator';
    return 'operator';
  }

  // Subscripts inherit from previous token (checked last so function chars like ₑ, ₙ match first)
  if (SUBSCRIPTS.includes(char)) {
    return state.lastTokenType;
  }

  // Default
  state.lastTokenType = null;

  return null;
}

export const uiuaStreamParser = {
  name: 'uiua',
  startState: (): UiuaState => ({ lastTokenType: null }),
  token: tokenize,
  languageData: {
    commentTokens: { line: '#' }
  }
};
