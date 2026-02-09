import { describe, expect, it } from 'vitest';
import {
  getContextForTypes,
  getBriefDescriptions,
  getImplementationHints
} from './context-injector';

describe('getContextForTypes', () => {
  it('returns formatted context for single node type', () => {
    const context = getContextForTypes(['slider']);

    expect(context).toContain('### slider');
    expect(context.length).toBeGreaterThan(50); // Should have some content
  });

  it('returns context for multiple node types', () => {
    const context = getContextForTypes(['slider', 'tone~', 'button']);

    expect(context).toContain('### slider');
    expect(context).toContain('### tone~');
    expect(context).toContain('### button');
    expect(context).toContain('---'); // Separator between sections
  });

  it('deduplicates node types', () => {
    const context = getContextForTypes(['slider', 'slider', 'slider']);

    // Should only have one slider section
    const sliderMatches = context.match(/### slider/g);
    expect(sliderMatches).toHaveLength(1);
  });

  it('handles unknown node types gracefully', () => {
    const context = getContextForTypes(['unknown-type-xyz']);

    expect(context).toContain('### unknown-type-xyz');

    // Should still return something (default prompt)
    expect(context.length).toBeGreaterThan(20);
  });
});

describe('getBriefDescriptions', () => {
  it('returns brief descriptions for node types', () => {
    const descriptions = getBriefDescriptions(['slider', 'button']);

    expect(descriptions).toHaveProperty('slider');
    expect(descriptions).toHaveProperty('button');
    expect(descriptions.slider.length).toBeLessThanOrEqual(300);
    expect(descriptions.button.length).toBeLessThanOrEqual(300);
  });

  it('deduplicates node types', () => {
    const descriptions = getBriefDescriptions(['slider', 'slider']);

    expect(Object.keys(descriptions)).toHaveLength(1);
  });
});

describe('getImplementationHints', () => {
  it('returns Web Audio hints for audio nodes', () => {
    const hints = getImplementationHints(['tone~', 'sampler~']);

    expect(hints).toContain('Requires Web Audio API (AudioContext)');
    expect(hints).toContain('Consider Tone.js library for higher-level audio abstractions');
  });

  it('returns p5.js hints for p5 nodes', () => {
    const hints = getImplementationHints(['p5']);

    expect(hints).toContain('Uses p5.js library for creative coding/graphics');
  });

  it('returns WebGL hints for shader nodes', () => {
    const hints = getImplementationHints(['glsl']);

    expect(hints).toContain('Uses WebGL for custom GLSL shaders');
  });

  it('returns Hydra hints for hydra nodes', () => {
    const hints = getImplementationHints(['hydra']);

    expect(hints).toContain('Uses Hydra library for live-coding visuals');
    expect(hints).toContain('Hydra uses WebGL shaders internally');
  });

  it('returns hints for messaging nodes', () => {
    const hints = getImplementationHints(['send', 'recv']);

    expect(hints).toContain('Uses named message channels (like Pd send/receive)');
  });

  it('returns UI hints for control nodes', () => {
    const hints = getImplementationHints(['slider', 'button', 'toggle']);

    expect(hints).toContain('Simple HTML inputs can replicate these UI controls');
  });

  it('deduplicates hints', () => {
    const hints = getImplementationHints(['tone~', 'sampler~', 'soundfile~']);

    // Should only have one Web Audio hint
    const webAudioHints = hints.filter((h) => h.includes('Web Audio API'));
    expect(webAudioHints).toHaveLength(1);
  });

  it('returns empty array for unknown node types', () => {
    const hints = getImplementationHints(['unknown-type']);

    expect(hints).toEqual([]);
  });

  it('returns Three.js hints for three nodes', () => {
    const hints = getImplementationHints(['three']);

    expect(hints).toContain('Uses Three.js for 3D graphics');
  });

  it('returns WebGPU hints for wgpu nodes', () => {
    const hints = getImplementationHints(['wgpu']);

    expect(hints).toContain('Uses WebGPU for compute shaders (requires WebGPU-capable browser)');
  });

  it('returns Python hints for python nodes', () => {
    const hints = getImplementationHints(['python']);

    expect(hints).toContain('Uses Pyodide (Python in WebAssembly)');
  });
});
