import { afterEach, describe, expect, it } from 'vitest';

import { MessageSystem } from '$lib/messages';

import { createTestPatchRuntime } from '../utils/runtime-test-utils';

describe('js onGraphChange', () => {
  const messageSystem = MessageSystem.getInstance();
  const compilerId = 'shader-compiler';
  const glslId = 'glsl-target';

  afterEach(() => {
    messageSystem.unregisterNode(glslId);
    messageSystem.updateEdges([]);
  });

  it('emits generated source for tagged fragments through its output edge', async () => {
    const runtime = createTestPatchRuntime();
    const received: unknown[] = [];

    messageSystem.registerNode(glslId).addCallback((message) => received.push(message));

    await runtime.setGraph({
      objects: [
        {
          id: compilerId,
          type: 'js',
          data: {
            runOnMount: true,
            code: `onGraphChange({ tags: ['shader/foo/*'] }, ({ nodes }) => send({ type: 'setCode', value: nodes.map(({ data }) => data.code).join('\\n') }))`
          }
        },
        {
          id: 'fragment',
          type: 'js',
          data: {
            tags: ['shader/foo/function'],
            code: 'float noise() { return 0.0; }'
          }
        },
        {
          id: glslId,
          type: 'glsl',
          data: {}
        }
      ],
      connections: [
        {
          id: 'compiler-glsl',
          source: compilerId,
          outlet: 'message-out',
          target: glslId,
          inlet: 'message-in'
        }
      ]
    });

    expect(received).toEqual([
      {
        type: 'setCode',
        value: 'float noise() { return 0.0; }'
      }
    ]);

    await runtime.updateObject('fragment', {
      id: 'fragment',
      type: 'js',
      data: {
        tags: ['shader/foo/function'],
        code: 'float noise() { return 1.0; }'
      }
    });

    expect(received).toEqual([
      { type: 'setCode', value: 'float noise() { return 0.0; }' },
      { type: 'setCode', value: 'float noise() { return 1.0; }' }
    ]);

    runtime.destroyObject(compilerId);

    await runtime.updateObject('fragment', {
      id: 'fragment',
      type: 'js',
      data: {
        tags: ['shader/foo/function'],
        code: 'float noise() { return 2.0; }'
      }
    });

    expect(received).toHaveLength(2);

    runtime.destroy();
  });
});
