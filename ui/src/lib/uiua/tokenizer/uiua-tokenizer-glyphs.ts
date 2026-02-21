/**
 * Uiua glyph definitions for tokenizers.
 * Derived from uiua-docs.ts - the single source of truth.
 */

import { uiuaGlyphDocs } from '../uiua-docs';

/** Helper to collect glyphs by their type */
const glyphsByType = (...types: string[]): Set<string> =>
  new Set(
    Object.entries(uiuaGlyphDocs)
      .filter(([, doc]) => types.includes(doc.type))
      .map(([glyph]) => glyph)
  );

// Monadic functions (including noadic) - cyan
export const MONADIC_FUNCTIONS = glyphsByType('monadic function');

// Dyadic functions - green
export const DYADIC_FUNCTIONS = glyphsByType('dyadic function');

// Monadic modifiers (1-modifiers) - pink
export const MONADIC_MODIFIERS = glyphsByType('monadic modifier');

// Dyadic modifiers (2-modifiers) - yellow
export const DYADIC_MODIFIERS = glyphsByType('dyadic modifier');

// Constants - orange (same as numbers)
export const CONSTANTS = glyphsByType('constant');

// Stack operations - light
export const STACK_OPS = glyphsByType('stack');

// Subscript characters (not in docs, keep hardcoded)
export const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₔₕₖₗₘₙₚₛₜ';

/**
 * Check if a character is a Uiua glyph that has documentation
 */
export function isUiuaGlyph(char: string): boolean {
  return char in uiuaGlyphDocs;
}
