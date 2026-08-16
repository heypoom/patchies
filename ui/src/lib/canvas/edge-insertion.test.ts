import { describe, expect, test } from 'vitest';
import type { Edge, Node } from '@xyflow/svelte';
import type { ObjectSchemaRegistry } from '$lib/objects/schemas';
import { glslSchema } from '$objects/glsl/schema';
import { preset as glslPipePreset } from '$presets/glsl/passthru';
import { PRESETS } from '$lib/presets/presets';
import { hydraSchema } from '$objects/hydra/schema';
import { threeSchema } from '$objects/three/schema';
import { reglSchema } from '$objects/regl/schema';
import {
  applyEdgeInsertionPipePreset,
  getEdgeInsertionObjectName,
  prepareNodeForEdgeInsertion
} from './edge-insertion-adapters';
import { DEFAULT_GLSL_CODE } from '$lib/canvas/constants';
import {
  createEdgeInsertionPreview,
  getCenteredNodeInsertionPosition,
  getEdgeInsertionPosition,
  planEdgeInsertion
} from './edge-insertion';

const schema = {
  pass: {
    type: 'pass',
    category: 'test',
    description: '',
    inlets: [{ id: 'in', description: '', handle: { handleType: 'message' } }],
    outlets: [{ id: 'out', description: '', handle: { handleType: 'message' } }]
  },
  audioOnly: {
    type: 'audioOnly',
    category: 'test',
    description: '',
    inlets: [{ id: 'in', description: '', handle: { handleType: 'audio', handleId: 0 } }],
    outlets: [{ id: 'out', description: '', handle: { handleType: 'audio', handleId: 0 } }]
  }
} satisfies ObjectSchemaRegistry;

const edge: Edge = {
  id: 'edge-1',
  source: 'left',
  sourceHandle: 'message-out',
  target: 'right',
  targetHandle: 'message-in'
};
const inserted: Node = { id: 'pass-1', type: 'pass', position: { x: 0, y: 0 }, data: {} };
const target: Node = { id: 'right', type: 'right', position: { x: 100, y: 100 }, data: {} };

describe('planEdgeInsertion', () => {
  test('uses the first compatible inlet and outlet', () => {
    expect(planEdgeInsertion(edge, inserted, target, schema, (node) => node.type)).toEqual({
      sourceHandle: 'message-out',
      insertedInletHandle: 'message-in',
      insertedOutletHandle: 'message-out',
      targetHandle: 'message-in'
    });
  });

  test('does not create a partial route when either side is incompatible', () => {
    expect(
      planEdgeInsertion(
        edge,
        { ...inserted, type: 'audioOnly' },
        target,
        schema,
        (node) => node.type
      )
    ).toBeNull();
  });

  test('uses GLSL sampler uniforms as dynamic video inlets', () => {
    const videoEdge: Edge = {
      ...edge,
      sourceHandle: 'video-out',
      targetHandle: 'video-in-0-source-sampler2D'
    };
    const glslNode: Node = {
      id: 'glsl-1',
      type: 'glsl',
      position: { x: 0, y: 0 },
      data: {
        glUniformDefs: [{ name: 'source', type: 'sampler2D' }]
      }
    };
    const glslTarget: Node = { ...target, type: 'glsl' };

    expect(
      planEdgeInsertion(videoEdge, glslNode, glslTarget, { glsl: glslSchema }, (node) => node.type)
    ).toEqual({
      sourceHandle: 'video-out',
      insertedInletHandle: 'video-in-0-source-sampler2D',
      insertedOutletHandle: 'video-out-out',
      targetHandle: 'video-in-0-source-sampler2D'
    });
  });

  test('turns a default GLSL generator into the GLSL pipe preset when inserted into a video edge', () => {
    const videoEdge: Edge = { ...edge, sourceHandle: 'video-out' };
    const prepared = prepareNodeForEdgeInsertion(
      {
        id: 'glsl-1',
        type: 'glsl',
        position: { x: 0, y: 0 },
        data: { code: DEFAULT_GLSL_CODE }
      },
      videoEdge
    );

    expect((prepared.data.glUniformDefs as { name: string }[])[0]?.name).toBe('image');
    expect(prepared.data.code).toBe(glslPipePreset.data.code);
  });

  test('keeps the glsl pipe preset code and derives its sampler inlet', () => {
    const prepared = prepareNodeForEdgeInsertion(
      {
        id: 'glsl-1',
        type: 'glsl',
        position: { x: 0, y: 0 },
        data: { code: 'uniform sampler2D image;' }
      },
      { ...edge, sourceHandle: 'video-out' }
    );

    expect(prepared.data.code).toBe('uniform sampler2D image;');
    expect(prepared.data.glUniformDefs).toMatchObject([{ name: 'image', type: 'sampler2D' }]);
  });

  test.each([
    ['hydra', hydraSchema],
    ['three', threeSchema],
    ['regl', reglSchema]
  ])('uses the default video ports for the %s pipe preset', (type, objectSchema) => {
    const videoEdge: Edge = {
      ...edge,
      sourceHandle: 'video-out-0',
      targetHandle: 'video-in-0'
    };
    const prepared = prepareNodeForEdgeInsertion(
      { id: `${type}-1`, type, position: { x: 0, y: 0 }, data: { code: 'pipe preset' } },
      videoEdge
    );

    expect(
      planEdgeInsertion(
        videoEdge,
        prepared,
        { ...target, type },
        { [type]: objectSchema },
        (node) => node.type
      )
    ).toEqual({
      sourceHandle: 'video-out-0',
      insertedInletHandle: 'video-in-0',
      insertedOutletHandle: 'video-out-0',
      targetHandle: 'video-in-0'
    });
  });
});

describe('getEdgeInsertionObjectName', () => {
  test.each(['js', 'glsl', 'hydra', 'regl', 'swgl', 'three', 'tone'])(
    'uses the %s pipe preset for edge insertion',
    (name) => {
      expect(getEdgeInsertionObjectName(name)).toBe(`${name}>`);
    }
  );

  test('keeps objects without a pipe preset unchanged', () => {
    expect(getEdgeInsertionObjectName('p5')).toBe('p5');
  });

  test.each(['js', 'glsl', 'hydra', 'regl', 'swgl', 'three', 'tone'])(
    'replaces the %s Quick Insert node with its pipe preset data',
    (name) => {
      const pipePresetName = `${name}>`;
      const node = applyEdgeInsertionPipePreset(
        { id: `${name}-1`, type: name, position: { x: 0, y: 0 }, data: {} },
        name
      );

      expect(node.type).toBe(PRESETS[pipePresetName]?.type);
      expect(node.data).toEqual(PRESETS[pipePresetName]?.data);
    }
  );
});

describe('getEdgeInsertionPosition', () => {
  test('places the node at the midpoint of the connected nodes', () => {
    expect(
      getEdgeInsertionPosition(edge, [
        { id: 'left', position: { x: 0, y: 0 }, width: 20, height: 20, data: {} },
        { id: 'right', position: { x: 100, y: 40 }, width: 20, height: 20, data: {} }
      ])
    ).toEqual({ x: 60, y: 30 });
  });

  test('centers the inserted node on the edge midpoint', () => {
    const nodes = [
      { id: 'left', position: { x: 0, y: 0 }, width: 20, height: 20, data: {} },
      { id: 'right', position: { x: 100, y: 40 }, width: 20, height: 20, data: {} }
    ];

    expect(
      getCenteredNodeInsertionPosition(edge, nodes, {
        id: 'inserted',
        position: { x: 0, y: 0 },
        measured: { width: 40, height: 10 },
        data: {}
      })
    ).toEqual({ x: 40, y: 25 });
  });
});

describe('createEdgeInsertionPreview', () => {
  test('temporarily routes both ends of the selected edge through generic object handles', () => {
    expect(
      createEdgeInsertionPreview(edge, 'quick-add', ['preview-left', 'preview-right'])
    ).toEqual([
      {
        id: 'preview-left',
        source: 'left',
        sourceHandle: 'message-out',
        target: 'quick-add',
        targetHandle: 'message-in',
        zIndex: 0,
        data: { edgeInsertionPreview: true }
      },
      {
        id: 'preview-right',
        source: 'quick-add',
        sourceHandle: 'message-out',
        target: 'right',
        targetHandle: 'message-in',
        zIndex: 0,
        data: { edgeInsertionPreview: true }
      }
    ]);
  });
});
