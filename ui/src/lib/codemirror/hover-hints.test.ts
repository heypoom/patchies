import { javascriptLanguage } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { glslInJsWrap } from '$lib/codemirror/glsl-in-js';
import { glslLanguage } from '$lib/codemirror/glsl.codemirror';
import { getCompletionHoverHint } from '$lib/codemirror/hover-hints';

function cursor(doc: string) {
  const pos = doc.indexOf('|');

  if (pos === -1) {
    throw new Error('Missing | cursor marker');
  }

  return { doc: doc.slice(0, pos) + doc.slice(pos + 1), pos };
}

const jsState = (doc: string) =>
  EditorState.create({ doc, extensions: [javascriptLanguage.configure({ wrap: glslInJsWrap })] });

const glslState = (doc: string) => EditorState.create({ doc, extensions: [glslLanguage] });

describe('completion hover hints', () => {
  it('uses Patchies JavaScript completion metadata for single-token globals', () => {
    const { doc, pos } = cursor('se|nd("hello")');

    const hint = getCompletionHoverHint(jsState(doc), pos, {
      language: 'javascript',
      nodeType: 'hydra'
    });

    expect(hint?.completion).toMatchObject({
      label: 'send',
      detail: '(message, options?) => void',
      info: 'Send a message to connected nodes. Options: {to: outletIndex}'
    });
  });

  it('uses Shader Park completion metadata in shaderpark nodes', () => {
    const { doc, pos } = cursor('let x = si|n(time);');

    const hint = getCompletionHoverHint(jsState(doc), pos, {
      language: 'javascript',
      nodeType: 'shaderpark'
    });

    expect(hint?.completion).toMatchObject({
      label: 'sin',
      detail: '(x: float | vecN) => same',
      info: 'Sine of an angle in radians.'
    });
  });

  it('uses GLSL completion metadata in GLSL editors', () => {
    const { doc, pos } = cursor('float d = leng|th(uv);');

    const hint = getCompletionHoverHint(glslState(doc), pos, {
      language: 'glsl'
    });

    expect(hint?.completion).toMatchObject({
      label: 'length',
      detail: '(v: vecN) => float',
      info: 'Vector magnitude.'
    });
  });

  it('uses GLSL completion metadata inside recognized GLSL-in-JS template strings', () => {
    const { doc, pos } = cursor('let sdf = glslSDF(`return leng|th(p);`);');

    const hint = getCompletionHoverHint(jsState(doc), pos, {
      language: 'javascript',
      nodeType: 'shaderpark'
    });

    expect(hint?.completion).toMatchObject({
      label: 'length',
      detail: '(v: vecN) => float',
      info: 'Vector magnitude.'
    });
  });

  it('does not show Patchies hover hints inside normal JavaScript strings', () => {
    const { doc, pos } = cursor('const label = "se|nd";');

    expect(
      getCompletionHoverHint(jsState(doc), pos, {
        language: 'javascript',
        nodeType: 'hydra'
      })
    ).toBeNull();
  });

  it('keeps template-string interpolation bodies in JavaScript hover context', () => {
    const { doc, pos } = cursor('glsl`vec2 p = ${se|nd("x")}`;');

    const hint = getCompletionHoverHint(jsState(doc), pos, {
      language: 'javascript',
      nodeType: 'hydra'
    });

    expect(hint?.completion.label).toBe('send');
  });
});
