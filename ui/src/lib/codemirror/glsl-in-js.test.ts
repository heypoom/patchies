import type { Input, SyntaxNodeRef } from '@lezer/common';
import { javascriptLanguage } from '@codemirror/lang-javascript';
import { describe, expect, it } from 'vitest';
import { isGlslTemplateString } from '$lib/codemirror/glsl-in-js';

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

  it('keeps unrelated function template strings in JavaScript mode', () => {
    expect(findTemplateStrings('let f = String.raw`not glsl`;')).toEqual([false]);
    expect(findTemplateStrings('let f = shaderParkHelper(`not glsl`);')).toEqual([false]);
  });
});
