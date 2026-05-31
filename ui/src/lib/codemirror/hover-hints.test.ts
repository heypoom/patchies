import { javascriptLanguage } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { glslInJsWrap } from '$lib/codemirror/glsl-in-js';
import { glslLanguage } from '$lib/codemirror/glsl.codemirror';
import { getCompletionHoverHint } from '$lib/codemirror/hover-hints';
import { peppermintLanguage } from '$lib/codemirror/peppermint.codemirror';

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

const peppermintState = (doc: string) =>
  EditorState.create({ doc, extensions: [peppermintLanguage] });

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

  it('uses Hydra completion metadata in hydra nodes', () => {
    const { doc, pos } = cursor('os|c(10, 0.1).out();');

    const hint = getCompletionHoverHint(jsState(doc), pos, {
      language: 'javascript',
      nodeType: 'hydra'
    });

    expect(hint?.completion).toMatchObject({
      label: 'osc',
      detail: '(frequency: float = 60, sync: float = 0.1, offset: float = 0) => Source',
      info: 'Create a color oscillator with separate red, green, and blue phase offsets.'
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

  it('does not show hover hints inside line comments', () => {
    const { doc, pos } = cursor('// se|nd("hello")');

    expect(
      getCompletionHoverHint(jsState(doc), pos, {
        language: 'javascript',
        nodeType: 'hydra'
      })
    ).toBeNull();
  });

  it('does not show hover hints inside block comments', () => {
    const { doc, pos } = cursor('/* se|nd("hello") */');

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

  it('uses Peppermint completion metadata in Peppermint editors', () => {
    const { doc, pos } = cursor('pri|nt(input())');

    const hint = getCompletionHoverHint(peppermintState(doc), pos, {
      language: 'peppermint'
    });

    expect(hint?.completion).toMatchObject({
      label: 'print',
      detail: 'print(value: Any) -> Any',
      info: 'Print a value to the virtual console and pass it through unchanged.'
    });
  });

  it('shows Peppermint send hover metadata', () => {
    const { doc, pos } = cursor('se|nd(input())');

    const hint = getCompletionHoverHint(peppermintState(doc), pos, {
      language: 'peppermint'
    });

    expect(hint?.completion).toMatchObject({
      label: 'send',
      detail: 'send(value: Any) -> Any',
      info: 'Send a value from the peppermint object and pass it through unchanged.'
    });
  });
});
