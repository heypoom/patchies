import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/svelte';
import {
  applyRepresentationFileWrite,
  buildObjectRepresentations,
  buildPatchRepresentation,
  PATCH_REPRESENTATION_VERSION
} from './representation';

const glslNode: Node = {
  id: 'glsl-24',
  type: 'glsl',
  position: { x: 0, y: 0 },
  data: { code: 'void mainImage() {}' }
};

const codeNode: Node = {
  id: 'js-7',
  type: 'js',
  position: { x: 0, y: 0 },
  data: { code: 'console.log("hello")' }
};

const expressionNode: Node = {
  id: 'expr-3',
  type: 'expr',
  position: { x: 0, y: 0 },
  data: { expr: '$1 * 2' }
};

describe('patch representation', () => {
  it('serializes supported objects without a global object index', () => {
    expect(buildPatchRepresentation('patch-1', [glslNode])).toEqual({
      format: PATCH_REPRESENTATION_VERSION,
      patchId: 'patch-1',
      objects: [
        {
          id: 'glsl-24',
          metadata: {
            format: PATCH_REPRESENTATION_VERSION,
            id: 'glsl-24',
            objectType: 'glsl',
            files: ['shader.frag']
          },
          files: { 'shader.frag': 'void mainImage() {}' }
        }
      ]
    });
  });

  it('maps a GLSL file write to its code field', () => {
    expect(applyRepresentationFileWrite([glslNode], 'glsl-24/shader.frag', 'new code')).toEqual({
      status: 'applied',
      nodeId: 'glsl-24',
      dataKey: 'code',
      oldValue: 'void mainImage() {}',
      newValue: 'new code',
      runDataKey: 'executeCode'
    });
  });

  it('represents code as JavaScript and JavaScript expressions with JavaScript file names', () => {
    expect(buildObjectRepresentations([codeNode, expressionNode])).toEqual([
      {
        id: 'js-7',
        metadata: {
          format: PATCH_REPRESENTATION_VERSION,
          id: 'js-7',
          objectType: 'js',
          files: ['code.js']
        },
        files: { 'code.js': 'console.log("hello")' }
      },
      {
        id: 'expr-3',
        metadata: {
          format: PATCH_REPRESENTATION_VERSION,
          id: 'expr-3',
          objectType: 'expr',
          files: ['expr.js']
        },
        files: { 'expr.js': '$1 * 2' }
      }
    ]);
  });

  it('maps generic code and expression file writes to their data fields', () => {
    expect(applyRepresentationFileWrite([codeNode], 'js-7/code.js', 'updated code')).toEqual({
      status: 'applied',
      nodeId: 'js-7',
      dataKey: 'code',
      oldValue: 'console.log("hello")',
      newValue: 'updated code',
      runDataKey: 'executeCode'
    });
    expect(applyRepresentationFileWrite([expressionNode], 'expr-3/expr.js', '$1 + $2')).toEqual({
      status: 'applied',
      nodeId: 'expr-3',
      dataKey: 'expr',
      oldValue: '$1 * 2',
      newValue: '$1 + $2',
      runDataKey: 'executeCode'
    });
  });

  it.each([
    ['hydra', 'code', 'shader.js'],
    ['p5', 'code', 'sketch.js'],
    ['shaderpark', 'code', 'sketch.js'],
    ['chuck~', 'expr', 'code.ck'],
    ['asm', 'code', 'code.asm'],
    ['csound~', 'expr', 'score.csd'],
    ['expr~', 'expr', 'expr.txt']
  ])('uses %s naming for %s', (objectType, dataKey, fileName) => {
    const node: Node = {
      id: `${objectType}-1`,
      type: objectType,
      position: { x: 0, y: 0 },
      data: { [dataKey]: 'source' }
    };

    expect(buildObjectRepresentations([node])[0]?.metadata.files).toEqual([fileName]);
  });

  it('omits nodes without a string code or expression field', () => {
    expect(
      buildObjectRepresentations([{ ...glslNode, type: 'group', data: { label: 'not code' } }])
    ).toEqual([]);
  });

  it('does not make unsupported paths mutable', () => {
    expect(applyRepresentationFileWrite([glslNode], 'glsl-24/patchies.object.json', '{}')).toEqual({
      status: 'unsupported'
    });
  });
});
