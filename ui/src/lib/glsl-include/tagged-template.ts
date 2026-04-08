/**
 * glsl tagged template literal for GLSL #include preprocessing.
 *
 * For Three.js nodes: required — resolves #include before ShaderMaterial sees the string.
 * For SwissGL/REGL nodes: optional — provides syntax highlighting hints for CodeMirror.
 *
 * Usage:
 *   const frag = await glsl`
 *     #include <lygia/generative/snoise>
 *     void main() { ... }
 *   `;
 */

import type { IncludeResolver } from './preprocessor';
import { processIncludes } from './preprocessor';

export const createGlslTag =
  (
    resolver: IncludeResolver
  ): ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<string>) =>
  async (strings, ...values) =>
    processIncludes(String.raw(strings, ...values), resolver);
