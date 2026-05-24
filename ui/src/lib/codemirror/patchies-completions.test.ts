import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import {
  createPatchiesCompletionSource,
  shouldShowPatchiesCompletions
} from '$lib/codemirror/patchies-completions';
import { createHydraCompletionSource } from '$lib/codemirror/hydra-completions';
import { createShaderParkCompletionSource } from '$lib/codemirror/shaderpark-completions';

function getCompletionLabels(nodeType: string, doc: string) {
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, doc.length, true);
  const result = createPatchiesCompletionSource({ nodeType })(context);

  return result?.options.map((option) => option.label) ?? [];
}

function getShaderParkCompletionLabels(nodeType: string, doc: string) {
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, doc.length, true);
  const result = createShaderParkCompletionSource({ nodeType })(context);

  return result?.options.map((option) => option.label) ?? [];
}

function getShaderParkCompletions(doc: string) {
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, doc.length, true);
  const result = createShaderParkCompletionSource({ nodeType: 'shaderpark' })(context);

  return result?.options ?? [];
}

function getShaderParkCompletion(label: string) {
  const completion = getShaderParkCompletions(`let value = ${label}`).find(
    (option) => option.label === label
  );

  if (!completion) {
    throw new Error(`Missing Shader Park completion: ${label}`);
  }

  return completion;
}

function getHydraCompletionLabels(nodeType: string, doc: string) {
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, doc.length, true);
  const result = createHydraCompletionSource({ nodeType })(context);

  return result?.options.map((option) => option.label) ?? [];
}

function getHydraCompletions(doc: string) {
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, doc.length, true);
  const result = createHydraCompletionSource({ nodeType: 'hydra' })(context);

  return result?.options ?? [];
}

function getHydraCompletion(doc: string, label: string) {
  const completion = getHydraCompletions(doc).find((option) => option.label === label);

  if (!completion) {
    throw new Error(`Missing Hydra completion: ${label}`);
  }

  return completion;
}

describe('patchies completions', () => {
  it('does not show Patchies API completions inside strings or template strings', () => {
    expect(getCompletionLabels('hydra', "'se")).toEqual([]);
    expect(getCompletionLabels('hydra', '"se')).toEqual([]);
    expect(getCompletionLabels('hydra', '`se')).toEqual([]);
    expect(getCompletionLabels('hydra', 'glsl`vec2 p = u')).toEqual([]);
  });

  it('still shows Patchies API completions inside template interpolations', () => {
    expect(getCompletionLabels('hydra', 'glsl`vec2 p = ${se')).toContain('send');
  });

  it('does not show Patchies API completions for shaderpark code', () => {
    expect(shouldShowPatchiesCompletions({ nodeType: 'shaderpark' })).toBe(false);
    expect(createPatchiesCompletionSource({ nodeType: 'shaderpark' })).toBeDefined();
    expect(getCompletionLabels('shaderpark', 'se')).toEqual([]);
    expect(getCompletionLabels('shaderpark', 'settings.')).toEqual([]);
  });

  it('still shows Patchies API completions for Patchies JavaScript contexts', () => {
    expect(shouldShowPatchiesCompletions({ nodeType: 'js' })).toBe(true);
    expect(getCompletionLabels('js', 'se')).toContain('send');
    expect(getCompletionLabels('js', 'settings.')).toContain('define');
  });

  it('shows the documented surface JavaScript API completions', () => {
    const labels = getCompletionLabels('surface', '');

    expect(labels).toEqual(
      expect.arrayContaining([
        'onPointer',
        'onTouch',
        'onKeyDown',
        'onKeyUp',
        'setDrawMode',
        'redraw',
        'setMouseForwarding',
        'activate',
        'deactivate',
        'hideExitButton',
        'noOutput'
      ])
    );
  });

  it('shows Shader Park completions only for shaderpark code', () => {
    expect(getShaderParkCompletionLabels('shaderpark', 'sp')).toContain('sphere');
    expect(getShaderParkCompletionLabels('shaderpark', 'setSpace(getS')).toContain('getSpace');
    expect(getShaderParkCompletionLabels('shaderpark', 'tim')).toContain('time');
    expect(getShaderParkCompletionLabels('shaderpark', 'glslSDF(`l')).toEqual([]);

    expect(getShaderParkCompletionLabels('js', 'sp')).toEqual([]);
    expect(getShaderParkCompletionLabels('shaderpark', '// sp')).toEqual([]);
  });

  it('shows Hydra completions only for hydra code', () => {
    expect(getHydraCompletionLabels('hydra', 'o')).toContain('osc');
    expect(getHydraCompletionLabels('hydra', 's')).toEqual(
      expect.arrayContaining(['src', 'shape', 'solid'])
    );
    expect(getHydraCompletionLabels('hydra', 'g')).toContain('gradient');
    expect(getHydraCompletionLabels('hydra', 'v')).toContain('voronoi');
    expect(getHydraCompletionLabels('hydra', 'n')).toContain('noise');
    expect(getHydraCompletionLabels('hydra', 'd')).toContain('datamosh');

    expect(getHydraCompletionLabels('js', 'o')).toEqual([]);
    expect(getHydraCompletionLabels('hydra', '// o')).toEqual([]);
    expect(getHydraCompletionLabels('hydra', 'setFunction({ glsl: `vec2 p = o')).toEqual([]);
    expect(getHydraCompletionLabels('hydra', 's')).not.toContain('s0');
    expect(getHydraCompletionLabels('hydra', 'o')).not.toContain('o0');
  });

  it('separates Hydra generators from chain method completions', () => {
    expect(getHydraCompletionLabels('hydra', 'l')).not.toContain('luma');
    expect(getHydraCompletionLabels('hydra', 'l')).not.toContain('layer');
    expect(getHydraCompletionLabels('hydra', 'd')).not.toContain('diff');

    expect(getHydraCompletionLabels('hydra', 'osc(30, 0.1, 0.8)\\n  .l')).toEqual(
      expect.arrayContaining(['luma', 'layer'])
    );
    expect(getHydraCompletionLabels('hydra', 'osc(30).d')).toContain('diff');
    expect(getHydraCompletionLabels('hydra', 'osc(30).o')).toContain('out');
    expect(getHydraCompletionLabels('hydra', 'osc(30).o')).not.toContain('osc');
  });

  it('describes Hydra transforms by behavior instead of implementation', () => {
    expect(getHydraCompletion('osc(30).l', 'luma')).toMatchObject({
      info: 'Use luminance as alpha, fading pixels in above the threshold.'
    });

    expect(getHydraCompletion('osc(30).l', 'layer')).toMatchObject({
      info: 'Alpha-composite another chain over the current chain.'
    });

    expect(getHydraCompletion('osc(30).d', 'diff')).toMatchObject({
      info: 'Show the absolute RGB difference between this chain and another chain.'
    });

    expect(getHydraCompletion('d', 'datamosh')).toMatchObject({
      detail: '(source, params?) => Source',
      info: 'Route a Hydra source through the native WebCodecs datamosh effect. Params: speed, keyFrame, fps, bitrate, scale, width, height.',
      apply: 'datamosh(s0, { speed: 2, fps: 30, scale: 0.5 })'
    });
  });

  it('adds short descriptions to Shader Park completions', () => {
    const missingDescriptions = getShaderParkCompletions('s')
      .filter((completion) => !completion.info)
      .map((completion) => completion.label);

    expect(missingDescriptions).toEqual([]);
  });

  it('uses useful Shader Park math signatures and descriptions', () => {
    expect(getShaderParkCompletion('sin')).toMatchObject({
      detail: '(x: float | vecN) => same',
      info: 'Sine of an angle in radians.'
    });
    expect(getShaderParkCompletion('nsin')).toMatchObject({
      detail: '(x: float) => float',
      info: 'Sine mapped from -1..1 into 0..1.'
    });
    expect(getShaderParkCompletion('pow')).toMatchObject({
      detail: '(base: T, exponent: T) => T',
      info: 'Raise base to exponent; dimensions must match.'
    });
    expect(getShaderParkCompletion('mix')).toMatchObject({
      detail: '(a: T, b: T, amount: float | T) => T',
      info: 'Linearly interpolate between matching values.'
    });
    expect(getShaderParkCompletion('length')).toMatchObject({
      detail: '(v: vec3) => float',
      info: 'Vector magnitude.'
    });
    expect(getShaderParkCompletion('refract')).toMatchObject({
      detail: '(incident: vec3, normal: vec3) => vec3',
      info: 'Refract an incident vector through a surface normal.'
    });
    expect(getShaderParkCompletion('atan')).toMatchObject({
      detail: '(y: float, x: float) => float',
      info: 'Arctangent from y and x, returning radians.'
    });
    expect(getShaderParkCompletion('step')).toMatchObject({
      detail: '(edge: float, x: float) => float',
      info: 'Return 0 below edge, otherwise 1.'
    });
  });

  it('describes shader-park-core SDF helper completions with actual arguments', () => {
    expect(getShaderParkCompletion('link')).toMatchObject({
      detail: '(length: float, radius: float, thickness: float) => void',
      info: 'Add a chain-link shape stretched along Y, with ring radius and tube thickness.'
    });
    expect(getShaderParkCompletion('boxFrame')).toMatchObject({
      detail: '(size: vec3, edge: float) => void',
      info: 'Add a hollow box frame with the given half-size and edge thickness.'
    });
    expect(getShaderParkCompletion('cappedTorus')).toMatchObject({
      detail: '(cap: vec2, radius: float, thickness: float) => void',
      info: 'Add a torus arc capped by a direction vector, radius, and tube thickness.'
    });
  });

  it('describes useful helpers exposed from shader-park-core sculpt.js', () => {
    expect(getShaderParkCompletion('repeat')).toMatchObject({
      detail: '(spacing: float | vec3, repetitions: float | vec3) => void',
      info: 'Repeat space at a regular interval.'
    });
    expect(getShaderParkCompletion('repeatLinear')).toMatchObject({
      detail: '(scale: vec3, spacing: vec3, counts: vec3) => { index: vec3, local: vec3 }',
      info: 'Repeat space on a bounded 3D grid.'
    });
    expect(getShaderParkCompletion('repeatRadial')).toMatchObject({
      detail: '(repeats: float) => float',
      info: 'Repeat space radially around the Y axis.'
    });
    expect(getShaderParkCompletion('reflectiveColor')).toMatchObject({
      detail: '(color: vec3 | r: float, g?: float, b?: float) => void',
      info: 'Set reflected material color.'
    });
    expect(getShaderParkCompletion('fresnel')).toMatchObject({
      detail: '(power: float) => float',
      info: 'Compute a view-angle Fresnel falloff.'
    });
    expect(getShaderParkCompletion('extractSDF')).toMatchObject({
      detail: '(primitive: (...args) => void) => (...args) => float',
      info: 'Wrap a primitive so it returns its SDF instead of applying it.'
    });
    expect(getShaderParkCompletion('vectorContourNoise')).toMatchObject({
      detail: '(space: vec3, offset: float, sinScale?: float) => vec3',
      info: 'Generate contour-like vector noise from repeated noise samples.'
    });
  });

  it('only shows value-returning Shader Park functions in expression positions', () => {
    expect(getShaderParkCompletionLabels('shaderpark', 'l')).toContain('line');
    expect(getShaderParkCompletionLabels('shaderpark', 'l')).toContain('lightDirection');
    expect(getShaderParkCompletionLabels('shaderpark', 'l')).not.toContain('log2');
    expect(getShaderParkCompletionLabels('shaderpark', 'l')).not.toContain('length');

    expect(getShaderParkCompletionLabels('shaderpark', 'let foo = l')).toContain('log2');
    expect(getShaderParkCompletionLabels('shaderpark', 'let foo = l')).toContain('length');
    expect(getShaderParkCompletionLabels('shaderpark', 'setSpace(l')).toContain('log2');
  });
});
