import type { Input, SyntaxNodeRef } from '@lezer/common';
import { CompletionContext } from '@codemirror/autocomplete';
import { javascriptLanguage } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import {
  glslInJsCompletions,
  glslInJsWrap,
  isGlslTemplateString
} from '$lib/codemirror/glsl-in-js';

function findTemplateStrings(doc: string) {
  const input = {
    read: (from: number, to: number) => doc.slice(from, to)
  } as Input;

  const results: boolean[] = [];

  javascriptLanguage.parser.parse(doc).iterate({
    enter(node: SyntaxNodeRef) {
      if (node.name === 'TemplateString') {
        results.push(isGlslTemplateString(node, input));
      }
    }
  });

  return results;
}

function getGlslInJsCompletionLabels(doc: string) {
  const state = EditorState.create({
    doc,
    extensions: [javascriptLanguage.configure({ wrap: glslInJsWrap })]
  });

  const context = new CompletionContext(state, doc.length, true);
  const result = glslInJsCompletions(context);

  return result?.options.map((option) => option.label) ?? [];
}

describe('glsl in js mixed parsing', () => {
  it('detects Shader Park GLSL helper strings as GLSL shader bodies', () => {
    expect(findTemplateStrings('let f = glslFunc(`vec3 f(){ return vec3(1.0); }`);')).toEqual([
      true
    ]);

    expect(findTemplateStrings('let f = glslFuncES3(`vec3 f(){ return vec3(1.0); }`);')).toEqual([
      true
    ]);

    expect(findTemplateStrings('let f = glslSDF(`float f(vec3 p){ return length(p); }`);')).toEqual(
      [true]
    );
  });

  it('detects htmlCanvas.glslLayer template strings as GLSL shader bodies', () => {
    expect(
      findTemplateStrings(
        'htmlCanvas.glslLayer(`void mainImage(out vec4 fragColor, in vec2 fragCoord) { fragColor = texture(source, fragCoord); }`);'
      )
    ).toEqual([true]);
  });

  it('keeps unrelated function template strings in JavaScript mode', () => {
    expect(findTemplateStrings('let f = String.raw`not glsl`;')).toEqual([false]);
    expect(findTemplateStrings('let f = shaderParkHelper(`not glsl`);')).toEqual([false]);
  });

  it('offers GLSL completions inside recognized GLSL template strings', () => {
    expect(getGlslInJsCompletionLabels('setFunction({ glsl: `vec2 p = u')).toContain('uv');
    expect(getGlslInJsCompletionLabels('glsl({ FP: `RGBA = tex')).toContain('texture');
    expect(getGlslInJsCompletionLabels('let sdf = glslSDF(`return l')).toContain('length');

    expect(getGlslInJsCompletionLabels('htmlCanvas.glslLayer(`fragColor = tex')).toContain(
      'texture'
    );
  });

  it('does not offer GLSL completions in normal template strings or interpolations', () => {
    expect(getGlslInJsCompletionLabels('let text = `u')).toEqual([]);
    expect(getGlslInJsCompletionLabels('glsl`vec2 p = ${u')).toEqual([]);
  });
});
