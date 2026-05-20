import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { glslDirectiveCompletions } from '$lib/codemirror/glsl.codemirror';
import { createGlslCompletionSource } from '$lib/codemirror/glsl-completions';

function getGlslCompletions(doc: string) {
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, doc.length, true);
  const result = createGlslCompletionSource()(context);

  return result?.options ?? [];
}

function getGlslCompletionLabels(doc: string) {
  return getGlslCompletions(doc).map((option) => option.label);
}

function getGlslCompletion(doc: string, label: string) {
  const completion = getGlslCompletions(doc).find((option) => option.label === label);

  if (!completion) {
    throw new Error(`Missing GLSL completion: ${label}`);
  }

  return completion;
}

function getGlslDirectiveCompletionLabels(doc: string) {
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, doc.length, true);
  const result = glslDirectiveCompletions(context);

  return result?.options.map((option) => option.label) ?? [];
}

describe('glsl completions', () => {
  it('suggests Patchies injected GLSL values only in expression positions', () => {
    expect(getGlslCompletionLabels('vec2 p = u')).toContain('uv');
    expect(getGlslCompletion('vec2 p = u', 'uv')).toMatchObject({
      detail: 'vec2',
      info: 'Patchies-injected normalized UV coordinate.'
    });

    expect(getGlslCompletionLabels('u')).toContain('uv');
  });

  it('suggests documented GLSL uniforms even at statement starts', () => {
    expect(getGlslCompletionLabels('i')).toContain('iTime');
    expect(getGlslCompletionLabels('i')).toContain('iResolution');
    expect(getGlslCompletionLabels('i')).toContain('iMouse');
    expect(getGlslCompletionLabels('i')).not.toContain('if');
    expect(getGlslCompletionLabels('i')).not.toContain('in');
    expect(getGlslCompletion('i', 'iTime')).toMatchObject({
      detail: 'float',
      info: 'Shader playback time in seconds.'
    });
  });

  it('does not pretend iChannel sampler uniforms are injected', () => {
    expect(getGlslCompletionLabels('vec4 c = i')).toContain('iResolution');
    expect(getGlslCompletionLabels('vec4 c = i')).toContain('iTime');
    expect(getGlslCompletionLabels('vec4 c = i')).not.toContain('iChannel0');
    expect(getGlslCompletionLabels('vec4 c = i')).not.toContain('iChannel3');
  });

  it('suggests generic sampler and entry point snippets', () => {
    expect(getGlslCompletionLabels('uniform s')).toContain('sampler2D');
    expect(getGlslCompletionLabels('uniform s')).not.toContain('sampler2D uniform');
    expect(getGlslCompletion('uniform s', 'sampler2D')).toMatchObject({
      info: 'Opaque 2D texture sampler type for uniforms and function parameters.'
    });

    expect(getGlslCompletionLabels('m')).toContain('mainImage');
    expect(getGlslCompletionLabels('m')).toContain('mainImage MRT');
  });

  it('only suggests sampler2D in declaration contexts', () => {
    expect(getGlslCompletionLabels('s')).not.toContain('sampler2D');
    expect(getGlslCompletionLabels('fragColor = s')).not.toContain('sampler2D');

    expect(getGlslCompletionLabels('uniform s')).toContain('sampler2D');
    expect(getGlslCompletionLabels('vec4 sample(s')).toContain('sampler2D');
    expect(getGlslCompletionLabels('vec4 sample(float amount, s')).toContain('sampler2D');
    expect(getGlslCompletionLabels('vec4 sample(in s')).toContain('sampler2D');
    expect(getGlslCompletionLabels('vec4 sample(s')).not.toContain('sampler2D uniform');
  });

  it('suggests dynamic uniform and array uniform snippets from the GLSL docs', () => {
    expect(getGlslCompletionLabels('uniform f')).toContain('float uniform');
    expect(getGlslCompletion('uniform f', 'float uniform')).toMatchObject({
      detail: 'declare numeric inlet',
      info: 'Declare a float uniform. Patchies creates a message inlet for it.'
    });

    expect(getGlslCompletionLabels('uniform v')).toContain('vec2 uniform');
    expect(getGlslCompletionLabels('uniform v')).toContain('vec2 array uniform');
    expect(getGlslCompletionLabels('uniform v')).toContain('vec3 uniform');
  });

  it('suggests common GLSL built-ins with useful signatures in expression positions', () => {
    expect(getGlslCompletion('fragColor = f', 'fragColor')).toMatchObject({
      detail: 'vec4',
      info: 'Conventional mainImage output color parameter.'
    });
    expect(getGlslCompletion('fragColor = tex', 'texture')).toMatchObject({
      detail: '(sampler: sampler2D, uv: vec2) => vec4',
      info: 'Sample a 2D texture.'
    });
    expect(getGlslCompletion('float x = sm', 'smoothstep')).toMatchObject({
      detail: '(edge0: T | float, edge1: T | float, x: T) => T',
      info: 'Smooth Hermite interpolation.'
    });
  });

  it('does not show normal GLSL completions inside comments', () => {
    expect(getGlslCompletionLabels('// u')).toEqual([]);
  });

  it('suggests include snippets from preprocessor context', () => {
    expect(getGlslCompletionLabels('#inc')).toContain('#include <lygia/...>');
    expect(getGlslCompletionLabels('#inc')).toContain('#include "..."');
  });

  it('suggests documented GLSL directive variants', () => {
    const labels = getGlslDirectiveCompletionLabels('// @');

    expect(labels).toContain('@param color');
    expect(labels).toContain('@param select');
    expect(labels).toContain('@format rgba16f');
    expect(labels).toContain('@format rgba8');
    expect(labels).toContain('@resolution WxH');
    expect(labels).toContain('@resolution 1/n');
  });
});
