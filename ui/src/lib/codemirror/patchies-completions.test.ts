import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import {
  createPatchiesCompletionSource,
  createShaderParkCompletionSource,
  shouldShowPatchiesCompletions
} from '$lib/codemirror/patchies-completions';

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
  const completion = getShaderParkCompletions(label).find((option) => option.label === label);

  if (!completion) {
    throw new Error(`Missing Shader Park completion: ${label}`);
  }

  return completion;
}

describe('patchies completions', () => {
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

  it('shows Shader Park completions only for shaderpark code', () => {
    expect(getShaderParkCompletionLabels('shaderpark', 'sp')).toContain('sphere');
    expect(getShaderParkCompletionLabels('shaderpark', 'getS')).toContain('getSpace');
    expect(getShaderParkCompletionLabels('shaderpark', 'tim')).toContain('time');

    expect(getShaderParkCompletionLabels('js', 'sp')).toEqual([]);
    expect(getShaderParkCompletionLabels('shaderpark', '// sp')).toEqual([]);
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
  });
});
