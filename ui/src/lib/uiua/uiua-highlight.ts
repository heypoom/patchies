/**
 * Uiua syntax highlighting for preview mode.
 * Generates HTML with spans for syntax highlighting.
 */

import { match } from 'ts-pattern';
import { tokenize, type TokenType } from './tokenizer/uiua-preview-tokenizer';
import { isUiuaGlyph } from './tokenizer/uiua-tokenizer-glyphs';

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

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

export function getUiuaGlyphColor(type: string): string {
  return match(type)
    .with('monadic function', () => 'text-[#7dcfff]')
    .with('dyadic function', () => 'text-[#9ece6a]')
    .with('monadic modifier', () => 'text-[#bb9af7]')
    .with('dyadic modifier', () => 'text-[#e0af68]')
    .with('constant', () => 'text-[#ff9e64]')
    .otherwise(() => 'text-[#c0caf5]');
}
