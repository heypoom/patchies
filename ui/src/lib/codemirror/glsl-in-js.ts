import { parseMixed } from '@lezer/common';
import { glslLanguage } from './glsl.codemirror';

// glsl`` tagged template (Three.js / explicit preprocessing)
const GLSL_TAG = new Set(['glsl']);

// Object property keys whose template string values are GLSL shader source:
// REGL: frag/vert, Hydra: glsl, SwissGL: FP/VP
const GLSL_PROPERTY_KEYS = new Set(['frag', 'vert', 'glsl', 'FP', 'VP']);

function isGlslTemplateString(
  node: import('@lezer/common').SyntaxNodeRef,
  input: import('@lezer/common').Input
): boolean {
  const parent = node.node.parent;
  if (!parent) return false;

  // glsl`...` tagged template
  if (parent.name === 'TaggedTemplateExpression') {
    const tag = parent.firstChild;
    return !!tag && GLSL_TAG.has(input.read(tag.from, tag.to));
  }

  // { frag: `...`, vert: `...`, glsl: `...`, FP: `...`, VP: `...` }
  if (parent.name === 'Property') {
    const key = parent.firstChild;
    return (
      !!key &&
      key.name === 'PropertyDefinition' &&
      GLSL_PROPERTY_KEYS.has(input.read(key.from, key.to))
    );
  }

  return false;
}

function glslOverlay(node: import('@lezer/common').SyntaxNodeRef): { from: number; to: number }[] {
  // Collect ranges covering all non-interpolation content inside the backticks.
  const overlay: { from: number; to: number }[] = [];
  let pos = node.from + 1; // skip opening backtick

  for (let child = node.node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'Interpolation') {
      if (pos < child.from) overlay.push({ from: pos, to: child.from });
      pos = child.to;
    }
  }

  const end = node.to - 1; // skip closing backtick
  if (pos < end) overlay.push({ from: pos, to: end });
  return overlay;
}

/**
 * parseMixed wrapper that highlights GLSL inside JS/TS nodes for:
 * - glsl`...` tagged templates (Three.js / explicit preprocessing)
 * - { frag: `...`, vert: `...` } (REGL)
 * - { glsl: `...` } (Hydra setFunction)
 * - { FP: `...`, VP: `...` } (SwissGL)
 *
 * ${...} interpolations are excluded from the GLSL overlay so JS
 * highlighting still applies inside them.
 */
export const glslInJsWrap = parseMixed((node, input) => {
  if (node.name !== 'TemplateString') return null;
  if (!isGlslTemplateString(node, input)) return null;
  return { parser: glslLanguage.parser, overlay: glslOverlay(node) };
});
