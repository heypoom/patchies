import { CompletionContext } from '@codemirror/autocomplete';
import { javascriptLanguage } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { createP5CompletionSource } from './p5-completions';
import { createPatchiesCompletionSource } from './patchies-completions';
import { getCompletionHoverHint } from './hover-hints';

function complete(doc: string, nodeType = 'p5') {
  const state = EditorState.create({ doc, extensions: [javascriptLanguage] });
  const context = new CompletionContext(state, doc.length, true);

  return createP5CompletionSource({ nodeType })(context);
}

const labels = (doc: string, nodeType = 'p5') =>
  complete(doc, nodeType)?.options.map((option) => option.label) ?? [];

describe('P5 completions', () => {
  it.each([
    ['fi', 'fill'],
    ['ell', 'ellipse'],
    ['pixelD', 'pixelDensity'],
    ['strokeW', 'strokeWeight'],
    ['splineV', 'splineVertex'],
    ['textB', 'textBounds'],
    ['createF', 'createFramebuffer'],
    ['ambientL', 'ambientLight'],
    ['loadJ', 'loadJSON'],
    ['randomG', 'randomGaussian'],
    ['createC', 'createCapture'],
    ['describeE', 'describeElement'],
    ['storeI', 'storeItem'],
    ['mouseX', 'mouseX'],
    ['WEB', 'WEBGL'],
    ['HS', 'HSB'],
    ['curveV', 'curveVertex'],
    ['createN', 'createNumberDict']
  ])('completes %s with %s', (doc, label) => {
    expect(labels(doc)).toContain(label);
  });

  it.each(['js', 'hydra', 'canvas', 'shaderpark'])('does not activate in %s nodes', (nodeType) => {
    expect(labels('fi', nodeType)).toEqual([]);
  });

  it.each(['// fi', '/* fi', "'fi", '"fi', '`fi', 'glsl`fi', 'thing.fi', 'thing?.fi'])(
    'suppresses P5 globals in %s',
    (doc) => {
      expect(labels(doc)).toEqual([]);
    }
  );

  it('suppresses globals after calls and inside long block comments', () => {
    expect(labels('createVector().fi')).toEqual([]);
    expect(labels(`/* ${'comment '.repeat(30)}fi`)).toEqual([]);
  });

  it('completes in template interpolation', () => {
    expect(labels('`value: ${fi')).toContain('fill');
  });

  it('inserts function calls but leaves callback names available for definitions', () => {
    expect(complete('fi')?.options.find((option) => option.label === 'fill')).toMatchObject({
      type: 'function',
      apply: 'fill()',
      info: 'Sets the color used to fill shapes.'
    });

    expect(
      complete('function set')?.options.find((option) => option.label === 'setup')
    ).toMatchObject({ apply: 'setup' });

    expect(labels('function touch')).toEqual(
      expect.arrayContaining(['touchStarted', 'touchMoved', 'touchEnded'])
    );

    expect(labels('function pre')).toContain('preload');
  });

  it('completes constructors and static vector helpers without exposing them as globals', () => {
    expect(labels('p5.')).toEqual(
      expect.arrayContaining([
        'Vector',
        'Graphics',
        'Color',
        'registerAddon',
        'disableFriendlyErrors'
      ])
    );

    expect(labels('p5.Vector.')).toEqual(
      expect.arrayContaining(['fromAngle', 'random2D', 'add', 'slerp'])
    );

    expect(
      complete('p5.Vector.ra')?.options.find((option) => option.label === 'random2D')
    ).toMatchObject({ apply: 'random2D()' });

    expect(labels('reg')).not.toContain('registerAddon');
    expect(labels('dis')).not.toContain('disableFriendlyErrors');
    expect(labels('fromA')).not.toContain('fromAngle');
  });

  it('keeps shared Patchies helpers available alongside P5', () => {
    const state = EditorState.create({ doc: 'createS' });
    const context = new CompletionContext(state, 7, true);

    expect(
      createPatchiesCompletionSource({ nodeType: 'p5' })(context)?.options.map(
        (option) => option.label
      )
    ).toContain('createSurfaceCanvas');

    expect(labels('createC')).toContain('createCanvas');
  });

  it('shows P5 signatures in hover hints', () => {
    const state = EditorState.create({ doc: 'fill(255)', extensions: [javascriptLanguage] });
    const hint = getCompletionHoverHint(state, 2, { language: 'javascript', nodeType: 'p5' });

    expect(hint?.completion.label).toBe('fill');
    expect(hint?.completion.detail).toContain('number');

    const memberState = EditorState.create({ doc: 'thing.fill', extensions: [javascriptLanguage] });

    expect(
      getCompletionHoverHint(memberState, 8, { language: 'javascript', nodeType: 'p5' })
    ).toBeNull();

    const vectorState = EditorState.create({
      doc: 'p5.Vector.random2D()',
      extensions: [javascriptLanguage]
    });

    expect(
      getCompletionHoverHint(vectorState, 13, { language: 'javascript', nodeType: 'p5' })
        ?.completion.label
    ).toBe('p5.Vector.random2D');
  });
});
