/**
 * Uiua language support for CodeMirror
 *
 * Syntax highlighting for Uiua array programming language.
 * Based on syntax rules from codereport/array-box
 * https://github.com/codereport/array-box
 */

import {
  StreamLanguage,
  LanguageSupport,
  HighlightStyle,
  syntaxHighlighting
} from '@codemirror/language';
import { hoverTooltip, tooltips, type Tooltip } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { tags } from '@lezer/highlight';
import { getUiuaGlyphDoc, UIUA_TOOLTIP_DELAY_MS } from '$lib/uiua/uiua-docs';
import { uiuaStreamParser } from '$lib/uiua/uiua-codemirror-tokenizer';

export const uiuaLanguage = StreamLanguage.define(uiuaStreamParser);

/**
 * Create a tooltip element for a Uiua glyph
 */
function createTooltipElement(doc: {
  glyph: string;
  name: string;
  type: string;
  signature: string;
  description: string;
  docUrl: string;
}): HTMLElement {
  const container = document.createElement('div');
  container.className = 'uiua-tooltip';

  // Header: glyph and name
  const header = document.createElement('div');
  header.className = 'uiua-tooltip-header';

  const glyph = document.createElement('span');
  glyph.className = 'uiua-tooltip-glyph';
  glyph.textContent = doc.glyph;
  header.appendChild(glyph);

  const name = document.createElement('span');
  name.className = 'uiua-tooltip-name';
  name.textContent = doc.name;
  header.appendChild(name);

  container.appendChild(header);

  // Type and signature
  const meta = document.createElement('div');
  meta.className = 'uiua-tooltip-meta';
  meta.textContent = `${doc.type} ${doc.signature}`;
  container.appendChild(meta);

  // Description
  const desc = document.createElement('div');
  desc.className = 'uiua-tooltip-desc';
  desc.textContent = doc.description;
  container.appendChild(desc);

  return container;
}

/**
 * Hover tooltip extension for Uiua glyphs
 */
const uiuaHoverTooltip = hoverTooltip(
  (view, pos): Tooltip | null => {
    const { doc } = view.state;

    // Get the character at the hover position
    // Handle potential multi-byte Unicode characters
    const line = doc.lineAt(pos);
    const lineText = line.text;
    const lineOffset = pos - line.from;

    // Find the character at this position
    // Use spread to handle multi-byte chars correctly
    const chars = [...lineText];
    let charIndex = 0;
    let byteOffset = 0;

    for (let i = 0; i < chars.length; i++) {
      const charLen = chars[i].length;
      if (byteOffset + charLen > lineOffset) {
        charIndex = i;
        break;
      }
      byteOffset += charLen;
    }

    const char = chars[charIndex];
    if (!char) return null;

    // Look up the glyph documentation
    const glyphDoc = getUiuaGlyphDoc(char);
    if (!glyphDoc) return null;

    // Calculate the byte positions for highlighting
    const charStart = line.from + byteOffset;
    const charEnd = charStart + char.length;

    return {
      pos: charStart,
      end: charEnd,
      above: true,
      create: () => ({
        dom: createTooltipElement(glyphDoc)
      })
    };
  },
  { hoverTime: UIUA_TOOLTIP_DELAY_MS }
);

/**
 * Configure tooltips to render in document body so they can overflow node containers
 */
const uiuaTooltipConfig = tooltips({
  parent: document.body
});

/**
 * Custom syntax highlighting theme for Uiua
 * Matches the preview mode colors from uiua-highlight.ts
 */
const uiuaHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#7dcfff' }, // cyan - monadic functions
  { tag: tags.variableName, color: '#9ece6a' }, // green - dyadic functions
  { tag: tags.propertyName, color: '#bb9af7' }, // pink/purple - 1-modifiers
  { tag: tags.typeName, color: '#e0af68' }, // yellow - 2-modifiers
  { tag: tags.number, color: '#ff9e64' }, // orange - numbers/constants
  { tag: tags.string, color: '#9ece6a' }, // green - strings
  { tag: tags.comment, color: '#565f89' }, // gray - comments
  { tag: tags.operator, color: '#c0caf5' } // light - stack ops
]);

export function uiua(): LanguageSupport {
  return new LanguageSupport(uiuaLanguage, [
    uiuaHoverTooltip,
    uiuaTooltipConfig,
    // Use Prec.highest to override tokyoNight theme colors
    Prec.highest(syntaxHighlighting(uiuaHighlightStyle))
  ]);
}
