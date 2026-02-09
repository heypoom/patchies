/**
 * Gathers object-specific context/descriptions for node types in a patch.
 * Reuses the existing AI prompt infrastructure.
 */

import { getObjectSpecificInstructions } from '../object-prompts/index';

/**
 * Gets detailed context/descriptions for a list of node types.
 * Returns a formatted string with all relevant object documentation.
 */
export function getContextForTypes(nodeTypes: string[]): string {
  const uniqueTypes = [...new Set(nodeTypes)];

  const sections = uniqueTypes.map((type) => {
    const instructions = getObjectSpecificInstructions(type);

    return `### ${type}\n\n${instructions}`;
  });

  return sections.join('\n\n---\n\n');
}

/**
 * Gets a brief summary of what each node type does.
 * Extracts just the first paragraph or sentence from each prompt.
 */
export function getBriefDescriptions(nodeTypes: string[]): Record<string, string> {
  const uniqueTypes = [...new Set(nodeTypes)];
  const descriptions: Record<string, string> = {};

  for (const type of uniqueTypes) {
    const fullInstructions = getObjectSpecificInstructions(type);
    // Extract first paragraph (up to first double newline or 200 chars)
    const firstParagraph = fullInstructions.split(/\n\n/)[0] || fullInstructions;
    descriptions[type] = firstParagraph.slice(0, 300).trim();
  }

  return descriptions;
}

/**
 * Determines implementation hints based on node types.
 * Returns platform/API requirements.
 */
export function getImplementationHints(nodeTypes: string[]): string[] {
  const hints: string[] = [];
  const typeSet = new Set(nodeTypes);

  // Audio nodes
  if (
    typeSet.has('tone~') ||
    typeSet.has('sampler~') ||
    typeSet.has('soundfile~') ||
    typeSet.has('object')
  ) {
    hints.push('Requires Web Audio API (AudioContext)');
    hints.push('Consider Tone.js library for higher-level audio abstractions');
  }

  if (typeSet.has('elem~')) {
    hints.push('Uses Elementary Audio library for functional audio DSP');
  }

  if (typeSet.has('sonic~')) {
    hints.push('Uses SuperSonic (SuperCollider-like) audio engine');
  }

  if (typeSet.has('chuck~')) {
    hints.push('Uses WebChucK (ChucK audio language in WebAssembly)');
  }

  if (typeSet.has('csound~')) {
    hints.push('Uses Csound via WebAssembly');
  }

  // Visual nodes
  if (typeSet.has('p5')) {
    hints.push('Uses p5.js library for creative coding/graphics');
  }

  if (typeSet.has('hydra')) {
    hints.push('Uses Hydra library for live-coding visuals');
    hints.push('Hydra uses WebGL shaders internally');
  }

  if (typeSet.has('glsl') || typeSet.has('swgl')) {
    hints.push('Uses WebGL for custom GLSL shaders');
    hints.push('Consider using a WebGL abstraction library (Three.js, regl, etc.)');
  }

  if (typeSet.has('three') || typeSet.has('three.dom')) {
    hints.push('Uses Three.js for 3D graphics');
  }

  if (typeSet.has('wgpu')) {
    hints.push('Uses WebGPU for compute shaders (requires WebGPU-capable browser)');
  }

  if (typeSet.has('canvas') || typeSet.has('canvas.dom')) {
    hints.push('Uses Canvas 2D API for graphics');
  }

  // Language nodes
  if (typeSet.has('python')) {
    hints.push('Uses Pyodide (Python in WebAssembly)');
  }

  if (typeSet.has('ruby')) {
    hints.push('Uses ruby.wasm (Ruby in WebAssembly)');
  }

  if (typeSet.has('uxn')) {
    hints.push('Uses Uxn virtual machine');
  }

  if (typeSet.has('asm')) {
    hints.push('Uses AssemblyScript compiled to WebAssembly');
  }

  // Live coding
  if (typeSet.has('strudel')) {
    hints.push('Uses Strudel for live-coded patterns and music');
  }

  if (typeSet.has('orca')) {
    hints.push('Uses ORCA esoteric programming language for sequencing');
  }

  // UI nodes
  if (typeSet.has('slider') || typeSet.has('button') || typeSet.has('toggle')) {
    hints.push('Simple HTML inputs can replicate these UI controls');
  }

  if (typeSet.has('dom') || typeSet.has('vue')) {
    hints.push('Custom DOM/Vue components for UI');
  }

  // Messaging
  if (typeSet.has('send') || typeSet.has('recv')) {
    hints.push('Uses named message channels (like Pd send/receive)');
    hints.push('Can implement with custom event bus or pub/sub pattern');
  }

  return [...new Set(hints)]; // Remove duplicates
}
