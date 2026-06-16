import { describe, expect, it } from 'vitest';

import { analyzePatchbay } from './patchbay-parser';

describe('analyzePatchbay', () => {
  it('expands message route chains into pairwise routes', () => {
    const result = analyzePatchbay(
      `
      [Message]
      chan B
      A -> B -> C
      `,
      { message: new Set(['A', 'C']) }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.messageRoutes).toEqual([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' }
    ]);
  });

  it('allows the same local channel name in different sections', () => {
    const result = analyzePatchbay(
      `
      [Message]
      chan Bus
      A -> Bus

      [Audio]
      chan Bus
      X -> Bus
      `,
      {
        message: new Set(['A']),
        audio: new Set(['X'])
      }
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.messageRoutes).toEqual([{ from: 'A', to: 'Bus' }]);
  });

  it('reports unknown message channels without matching object titles', () => {
    const result = analyzePatchbay(
      `
      [Message]
      Clock -> Logger
      `,
      {
        message: new Set(['Clock']),
        objectTitles: new Set(['Logger'])
      }
    );

    expect(result.messageRoutes).toEqual([]);

    expect(result.diagnostics).toMatchObject([
      {
        severity: 'error',
        code: 'unknown-channel',
        section: 'message',
        name: 'Logger'
      }
    ]);
  });

  it('reports message cycles', () => {
    const result = analyzePatchbay(
      `
      [Message]
      chan A
      chan B
      A -> B
      B -> A
      `
    );

    expect(result.messageRoutes).toEqual([]);

    expect(result.diagnostics).toMatchObject([
      {
        severity: 'error',
        code: 'cycle',
        section: 'message'
      }
    ]);
  });

  it('rejects receiver-only channels as route sources', () => {
    const result = analyzePatchbay(
      `
      [Message]
      chan Bus
      Inbound -> Bus
      `,
      {
        messageTargets: new Set(['Inbound'])
      }
    );

    expect(result.messageRoutes).toEqual([]);

    expect(result.diagnostics).toMatchObject([
      {
        severity: 'error',
        code: 'receiver-as-source',
        section: 'message',
        name: 'Inbound'
      }
    ]);
  });

  it('rejects sender-only channels as route targets', () => {
    const result = analyzePatchbay(
      `
      [Message]
      chan Bus
      Bus -> Outbound
      `,
      {
        messageSources: new Set(['Outbound']),
        messageTargets: new Set()
      }
    );

    expect(result.messageRoutes).toEqual([]);
    expect(result.diagnostics).toMatchObject([
      {
        severity: 'error',
        code: 'sender-as-target',
        section: 'message',
        name: 'Outbound'
      }
    ]);
  });

  it('does not report role errors for unknown channels', () => {
    const result = analyzePatchbay(
      `
      [Message]
      chan Bus
      Missing -> Bus
      `,
      {
        messageSources: new Set(),
        messageTargets: new Set()
      }
    );

    expect(result.messageRoutes).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['unknown-channel']);
  });

  it('expands audio route chains using audio sender and receiver roles', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      chan Bus
      Mic -> Bus -> Out
      `,
      {
        audioSources: new Set(['Mic']),
        audioTargets: new Set(['Out'])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.audioRoutes).toEqual([
      { from: 'Mic', to: 'Bus' },
      { from: 'Bus', to: 'Out' }
    ]);
  });

  it('normalizes audio shorthand into an anonymous virtual expression', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      Mic * 0.5 -> Out
      `,
      {
        audioSources: new Set(['Mic']),
        audioTargets: new Set(['Out'])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.virtualAudioExpressions).toEqual([
      expect.objectContaining({
        expression: 's * 0.5',
        anonymous: true,
        line: 3
      })
    ]);

    expect(result.audioRoutes).toEqual([
      {
        from: 'Mic',
        to: expect.stringContaining('expr~'),
        toVirtualExpression: expect.objectContaining({
          expression: 's * 0.5',
          anonymous: true
        })
      },
      {
        from: expect.stringContaining('expr~'),
        to: 'Out',
        fromVirtualExpression: expect.objectContaining({
          expression: 's * 0.5',
          anonymous: true
        })
      }
    ]);
  });

  it('resolves explicit audio virtual expression aliases before channels', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      Gain = expr~ s * 0.5
      Mic -> Gain -> Out
      `,
      {
        audioSources: new Set(['Mic']),
        audioTargets: new Set(['Out'])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.virtualAudioExpressions).toEqual([
      expect.objectContaining({
        name: 'Gain',
        expression: 's * 0.5',
        anonymous: false,
        line: 3
      })
    ]);

    expect(result.audioRoutes).toEqual([
      expect.objectContaining({
        from: 'Mic',
        to: 'Gain',
        toVirtualExpression: expect.objectContaining({ name: 'Gain' })
      }),

      expect.objectContaining({
        from: 'Gain',
        to: 'Out',
        fromVirtualExpression: expect.objectContaining({ name: 'Gain' })
      })
    ]);
  });

  it('resolves explicit audio fexpr aliases before channels', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      Smooth = fexpr~ x1 * 0.5 + x1[-1] * 0.5
      Mic -> Smooth -> Out
      `,
      {
        audioSources: new Set(['Mic']),
        audioTargets: new Set(['Out'])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.virtualAudioExpressions).toEqual([
      expect.objectContaining({
        name: 'Smooth',
        type: 'fexpr~',
        rawArgs: ['x1', '*', '0.5', '+', 'x1[-1]', '*', '0.5'],
        params: [null, 'x1 * 0.5 + x1[-1] * 0.5'],
        expression: 'x1 * 0.5 + x1[-1] * 0.5',
        anonymous: false,
        line: 3
      })
    ]);

    expect(result.audioRoutes).toEqual([
      expect.objectContaining({
        from: 'Mic',
        to: 'Smooth',
        toVirtualExpression: expect.objectContaining({ name: 'Smooth', type: 'fexpr~' })
      }),

      expect.objectContaining({
        from: 'Smooth',
        to: 'Out',
        fromVirtualExpression: expect.objectContaining({ name: 'Smooth', type: 'fexpr~' })
      })
    ]);
  });

  it('resolves whitelisted audio effect aliases as virtual audio nodes', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      Filter = lowpass~ 1000 1
      Mic -> Filter -> Out
      `,
      {
        audioSources: new Set(['Mic']),
        audioTargets: new Set(['Out'])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.virtualAudioExpressions).toEqual([
      expect.objectContaining({
        name: 'Filter',
        type: 'lowpass~',
        rawArgs: ['1000', '1'],
        params: [null, 1000, 1],
        anonymous: false,
        line: 3
      })
    ]);

    expect(result.audioRoutes).toEqual([
      expect.objectContaining({
        from: 'Mic',
        to: 'Filter',
        toVirtualExpression: expect.objectContaining({ name: 'Filter', type: 'lowpass~' })
      }),

      expect.objectContaining({
        from: 'Filter',
        to: 'Out',
        fromVirtualExpression: expect.objectContaining({ name: 'Filter', type: 'lowpass~' })
      })
    ]);
  });

  it('resolves inline whitelisted audio effect route segments as anonymous virtual audio nodes', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      Mic -> gain~ 0.5 -> Out
      `,
      {
        audioSources: new Set(['Mic']),
        audioTargets: new Set(['Out'])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.virtualAudioExpressions).toEqual([
      expect.objectContaining({
        type: 'gain~',
        rawArgs: ['0.5'],
        params: [null, 0.5],
        anonymous: true,
        line: 3
      })
    ]);

    expect(result.audioRoutes).toEqual([
      expect.objectContaining({
        from: 'Mic',
        to: expect.stringContaining('gain~'),
        toVirtualExpression: expect.objectContaining({ type: 'gain~', anonymous: true })
      }),

      expect.objectContaining({
        from: expect.stringContaining('gain~'),
        to: 'Out',
        fromVirtualExpression: expect.objectContaining({ type: 'gain~', anonymous: true })
      })
    ]);
  });

  it('resolves inline expr route segments as anonymous virtual audio nodes', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      Osc -> expr~ s * 0.2 -> Out
      `,
      {
        audioSources: new Set(['Osc']),
        audioTargets: new Set(['Out'])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.virtualAudioExpressions).toEqual([
      expect.objectContaining({
        type: 'expr~',
        rawArgs: ['s', '*', '0.2'],
        params: [null, 's * 0.2'],
        expression: 's * 0.2',
        anonymous: true,
        line: 3
      })
    ]);

    expect(result.audioRoutes).toEqual([
      expect.objectContaining({
        from: 'Osc',
        to: expect.stringContaining('expr~'),
        toVirtualExpression: expect.objectContaining({ type: 'expr~', anonymous: true })
      }),

      expect.objectContaining({
        from: expect.stringContaining('expr~'),
        to: 'Out',
        fromVirtualExpression: expect.objectContaining({ type: 'expr~', anonymous: true })
      })
    ]);
  });

  it('resolves inline fexpr route segments as anonymous virtual audio nodes', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      Osc -> fexpr~ x1 * 0.5 + x1[-1] * 0.5 -> Out
      `,
      {
        audioSources: new Set(['Osc']),
        audioTargets: new Set(['Out'])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.virtualAudioExpressions).toEqual([
      expect.objectContaining({
        type: 'fexpr~',
        rawArgs: ['x1', '*', '0.5', '+', 'x1[-1]', '*', '0.5'],
        params: [null, 'x1 * 0.5 + x1[-1] * 0.5'],
        expression: 'x1 * 0.5 + x1[-1] * 0.5',
        anonymous: true,
        line: 3
      })
    ]);

    expect(result.audioRoutes).toEqual([
      expect.objectContaining({
        from: 'Osc',
        to: expect.stringContaining('fexpr~'),
        toVirtualExpression: expect.objectContaining({ type: 'fexpr~', anonymous: true })
      }),

      expect.objectContaining({
        from: expect.stringContaining('fexpr~'),
        to: 'Out',
        fromVirtualExpression: expect.objectContaining({ type: 'fexpr~', anonymous: true })
      })
    ]);
  });

  it('resolves whitelisted audio source aliases as virtual audio nodes', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      Osc = osc~ 440 sine 0
      Osc -> Out
      `,
      {
        audioTargets: new Set(['Out'])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.virtualAudioExpressions).toEqual([
      expect.objectContaining({
        name: 'Osc',
        type: 'osc~',
        rawArgs: ['440', 'sine', '0'],
        params: [440, 'sine', 0],
        anonymous: false,
        line: 3
      })
    ]);

    expect(result.audioRoutes).toEqual([
      expect.objectContaining({
        from: 'Osc',
        to: 'Out',
        fromVirtualExpression: expect.objectContaining({ name: 'Osc', type: 'osc~' })
      })
    ]);
  });

  it('resolves inline whitelisted audio source route segments as anonymous virtual audio nodes', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      osc~ 440 sine 0 -> Out
      `,
      {
        audioTargets: new Set(['Out'])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.virtualAudioExpressions).toEqual([
      expect.objectContaining({
        type: 'osc~',
        rawArgs: ['440', 'sine', '0'],
        params: [440, 'sine', 0],
        anonymous: true,
        line: 3
      })
    ]);

    expect(result.audioRoutes).toEqual([
      expect.objectContaining({
        from: expect.stringContaining('osc~'),
        to: 'Out',
        fromVirtualExpression: expect.objectContaining({ type: 'osc~', anonymous: true })
      })
    ]);
  });

  it('rejects unsupported audio nodes as virtual processors', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      Space = convolver~ impulse.wav
      Mic -> Space -> Out
      `,
      {
        audioSources: new Set(['Mic']),
        audioTargets: new Set(['Out'])
      }
    );

    expect(result.audioRoutes).toEqual([]);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        code: 'unsupported-virtual-audio-node',
        section: 'audio',
        name: 'Space',
        line: 3
      })
    );
  });

  it('rejects unsupported inline audio nodes as virtual processors', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      Mic -> convolver~ impulse.wav -> Out
      `,
      {
        audioSources: new Set(['Mic']),
        audioTargets: new Set(['Out'])
      }
    );

    expect(result.audioRoutes).toEqual([]);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        code: 'unsupported-virtual-audio-node',
        section: 'audio',
        name: 'convolver~',
        line: 3
      })
    );
  });

  it('reports invalid audio virtual expressions before applying routes', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      Gain = expr~ s *
      Mic -> Gain -> Out
      `,
      {
        audioSources: new Set(['Mic']),
        audioTargets: new Set(['Out'])
      }
    );

    expect(result.audioRoutes).toEqual([]);

    expect(result.diagnostics).toMatchObject([
      {
        severity: 'error',
        code: 'invalid-virtual-expression',
        section: 'audio',
        name: 'Gain',
        line: 3
      }
    ]);
  });

  it('rejects audio receiver-only channels as route sources', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      chan Bus
      Inbound -> Bus
      `,
      {
        audioTargets: new Set(['Inbound'])
      }
    );

    expect(result.audioRoutes).toEqual([]);

    expect(result.diagnostics).toMatchObject([
      {
        severity: 'error',
        code: 'receiver-as-source',
        section: 'audio',
        name: 'Inbound'
      }
    ]);
  });

  it('rejects audio sender-only channels as route targets', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      chan Bus
      Bus -> Outbound
      `,
      {
        audioSources: new Set(['Outbound']),
        audioTargets: new Set()
      }
    );

    expect(result.audioRoutes).toEqual([]);

    expect(result.diagnostics).toMatchObject([
      {
        severity: 'error',
        code: 'sender-as-target',
        section: 'audio',
        name: 'Outbound'
      }
    ]);
  });

  it('expands video route chains using video sender and receiver roles', () => {
    const result = analyzePatchbay(
      `
      [Video]
      chan Mix
      Camera -> Mix -> Screen
      `,
      {
        videoSources: new Set(['Camera']),
        videoTargets: new Set(['Screen'])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.videoRoutes).toEqual([
      { from: 'Camera', to: 'Mix' },
      { from: 'Mix', to: 'Screen' }
    ]);
  });

  it('rejects video receiver-only channels as route sources', () => {
    const result = analyzePatchbay(
      `
      [Video]
      chan Mix
      Inbound -> Mix
      `,
      {
        videoTargets: new Set(['Inbound'])
      }
    );

    expect(result.videoRoutes).toEqual([]);

    expect(result.diagnostics).toMatchObject([
      {
        severity: 'error',
        code: 'receiver-as-source',
        section: 'video',
        name: 'Inbound'
      }
    ]);
  });

  it('rejects video sender-only channels as route targets', () => {
    const result = analyzePatchbay(
      `
      [Video]
      chan Mix
      Mix -> Outbound
      `,
      {
        videoSources: new Set(['Outbound']),
        videoTargets: new Set()
      }
    );

    expect(result.videoRoutes).toEqual([]);

    expect(result.diagnostics).toMatchObject([
      {
        severity: 'error',
        code: 'sender-as-target',
        section: 'video',
        name: 'Outbound'
      }
    ]);
  });

  it('resolves explicit object endpoints by compatible section port', () => {
    const result = analyzePatchbay(
      `
      [Video]
      Camera -> obj glsl-34:1

      [Message]
      obj slider-1 -> Logger
      `,
      {
        videoSources: new Set(['Camera']),
        messageTargets: new Set(['Logger']),
        objects: new Map([
          [
            'glsl-34',
            {
              video: {
                inlets: ['video-in-1-iChannel1-sampler2D', 'video-in-3-iChannel3-sampler2D'],
                outlets: ['video-out']
              }
            }
          ],
          [
            'slider-1',
            {
              message: {
                inlets: ['message-in-0'],
                outlets: ['message-out-0']
              }
            }
          ]
        ])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.videoRoutes).toEqual([
      {
        from: 'Camera',
        to: 'obj glsl-34:1',
        toEndpoint: {
          kind: 'object',
          nodeId: 'glsl-34',
          portIndex: 1,
          handle: 'video-in-3-iChannel3-sampler2D'
        }
      }
    ]);

    expect(result.messageRoutes).toEqual([
      {
        from: 'obj slider-1',
        to: 'Logger',
        fromEndpoint: {
          kind: 'object',
          nodeId: 'slider-1',
          portIndex: 0,
          handle: 'message-out-0'
        }
      }
    ]);
  });

  it('reports object endpoint errors separately from channel errors', () => {
    const result = analyzePatchbay(
      `
      [Audio]
      obj missing-1 -> obj gain-2:2
      `,
      {
        objects: new Map([
          [
            'gain-2',
            {
              audio: {
                inlets: ['audio-in-0'],
                outlets: ['audio-out']
              }
            }
          ]
        ])
      }
    );

    expect(result.audioRoutes).toEqual([]);

    expect(result.diagnostics).toMatchObject([
      {
        severity: 'error',
        code: 'unknown-object',
        section: 'audio',
        name: 'missing-1'
      },
      {
        severity: 'error',
        code: 'object-port-out-of-range',
        section: 'audio',
        name: 'gain-2:2'
      }
    ]);
  });

  it('resolves object aliases as section-local object endpoints', () => {
    const result = analyzePatchbay(
      `
      [Video]
      Edge = obj glsl-34
      Src -> Edge -> Aber
      `,
      {
        videoSources: new Set(['Src']),
        videoTargets: new Set(['Aber']),
        objects: new Map([
          [
            'glsl-34',
            {
              video: {
                inlets: ['video-in-0'],
                outlets: ['video-out']
              }
            }
          ]
        ])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.videoRoutes).toEqual([
      {
        from: 'Src',
        to: 'Edge',
        toEndpoint: {
          kind: 'object',
          nodeId: 'glsl-34',
          portIndex: 0,
          handle: 'video-in-0'
        }
      },
      {
        from: 'Edge',
        to: 'Aber',
        fromEndpoint: {
          kind: 'object',
          nodeId: 'glsl-34',
          portIndex: 0,
          handle: 'video-out'
        }
      }
    ]);
  });

  it('resolves object aliases declared after routes', () => {
    const result = analyzePatchbay(
      `
      [Message]
      Src -> Edge -> Aber
      Edge = obj js-1:1
      `,
      {
        messageSources: new Set(['Src']),
        messageTargets: new Set(['Aber']),
        objects: new Map([
          [
            'js-1',
            {
              message: {
                inlets: ['message-in-0', 'message-in-1'],
                outlets: ['message-out-0', 'message-out-1']
              }
            }
          ]
        ])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.messageRoutes).toEqual([
      {
        from: 'Src',
        to: 'Edge',
        toEndpoint: {
          kind: 'object',
          nodeId: 'js-1',
          portIndex: 1,
          handle: 'message-in-1'
        }
      },
      {
        from: 'Edge',
        to: 'Aber',
        fromEndpoint: {
          kind: 'object',
          nodeId: 'js-1',
          portIndex: 1,
          handle: 'message-out-1'
        }
      }
    ]);
  });

  it('reports duplicate object aliases and alias-channel collisions', () => {
    const result = analyzePatchbay(
      `
      [Message]
      chan Edge
      Edge = obj js-1
      Path = obj js-1
      Path = obj js-2
      `,
      {
        objects: new Map([
          ['js-1', { message: { inlets: ['message-in'], outlets: ['message-out'] } }],
          ['js-2', { message: { inlets: ['message-in'], outlets: ['message-out'] } }]
        ])
      }
    );

    expect(
      result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')
    ).toMatchObject([
      {
        severity: 'error',
        code: 'duplicate-alias',
        section: 'message',
        name: 'Edge',
        line: 4
      },
      {
        severity: 'error',
        code: 'duplicate-alias',
        section: 'message',
        name: 'Path',
        line: 6
      }
    ]);
  });

  it('continues a route chain from an indented arrow line', () => {
    const result = analyzePatchbay(
      `
      [Video]
      Src -> obj glsl-34
          -> Aber
      `,
      {
        videoSources: new Set(['Src']),
        videoTargets: new Set(['Aber']),
        objects: new Map([
          [
            'glsl-34',
            {
              video: {
                inlets: ['video-in-0'],
                outlets: ['video-out']
              }
            }
          ]
        ])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.videoRoutes).toEqual([
      {
        from: 'Src',
        to: 'obj glsl-34',
        toEndpoint: {
          kind: 'object',
          nodeId: 'glsl-34',
          portIndex: 0,
          handle: 'video-in-0'
        }
      },
      {
        from: 'obj glsl-34',
        to: 'Aber',
        fromEndpoint: {
          kind: 'object',
          nodeId: 'glsl-34',
          portIndex: 0,
          handle: 'video-out'
        }
      }
    ]);
  });

  it('continues a route chain from endpoint-only and arrow-leading lines', () => {
    const result = analyzePatchbay(
      `
      [Message]
      Src
      -> obj js-1
      -> Aber
      `,
      {
        messageSources: new Set(['Src']),
        messageTargets: new Set(['Aber']),
        objects: new Map([
          [
            'js-1',
            {
              message: {
                inlets: ['message-in-0'],
                outlets: ['message-out-0']
              }
            }
          ]
        ])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.messageRoutes).toEqual([
      {
        from: 'Src',
        to: 'obj js-1',
        toEndpoint: {
          kind: 'object',
          nodeId: 'js-1',
          portIndex: 0,
          handle: 'message-in-0'
        }
      },
      {
        from: 'obj js-1',
        to: 'Aber',
        fromEndpoint: {
          kind: 'object',
          nodeId: 'js-1',
          portIndex: 0,
          handle: 'message-out-0'
        }
      }
    ]);
  });

  it('reports continuation endpoint diagnostics on their own line', () => {
    const result = analyzePatchbay(
      `
      [Message]
      Src
      -> Missing
      `,
      {
        messageSources: new Set(['Src'])
      }
    );

    expect(result.messageRoutes).toEqual([]);

    expect(result.diagnostics).toMatchObject([
      {
        severity: 'error',
        code: 'unknown-channel',
        section: 'message',
        name: 'Missing',
        line: 4
      }
    ]);
  });

  it('continues a route chain from dangling-arrow lines', () => {
    const result = analyzePatchbay(
      `
      [Video]
      Src ->
      obj glsl-34 ->
      Aber
      `,
      {
        videoSources: new Set(['Src']),
        videoTargets: new Set(['Aber']),
        objects: new Map([
          [
            'glsl-34',
            {
              video: {
                inlets: ['video-in-0'],
                outlets: ['video-out']
              }
            }
          ]
        ])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.videoRoutes).toEqual([
      {
        from: 'Src',
        to: 'obj glsl-34',
        toEndpoint: {
          kind: 'object',
          nodeId: 'glsl-34',
          portIndex: 0,
          handle: 'video-in-0'
        }
      },
      {
        from: 'obj glsl-34',
        to: 'Aber',
        fromEndpoint: {
          kind: 'object',
          nodeId: 'glsl-34',
          portIndex: 0,
          handle: 'video-out'
        }
      }
    ]);
  });

  it('continues a two-endpoint route from a dangling arrow', () => {
    const result = analyzePatchbay(
      `
      [Message]
      Foo ->
      Bar
      `,
      {
        messageSources: new Set(['Foo']),
        messageTargets: new Set(['Bar'])
      }
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.messageRoutes).toEqual([{ from: 'Foo', to: 'Bar' }]);
  });

  it('continues a route chain across comment lines', () => {
    const result = analyzePatchbay(
      `
      [Video]

      Src = obj hydra-39
      Edge = obj glsl-34

      Src
      // -> Edge
      -> Aber
      `,
      {
        videoTargets: new Set(['Aber']),
        objects: new Map([
          [
            'hydra-39',
            {
              video: {
                inlets: ['video-in-0'],
                outlets: ['video-out-0']
              }
            }
          ],
          [
            'glsl-34',
            {
              video: {
                inlets: ['video-in-0'],
                outlets: ['video-out']
              }
            }
          ]
        ])
      }
    );

    expect(result.diagnostics).toEqual([]);

    expect(result.videoRoutes).toEqual([
      {
        from: 'Src',
        to: 'Aber',
        fromEndpoint: {
          kind: 'object',
          nodeId: 'hydra-39',
          portIndex: 0,
          handle: 'video-out-0'
        }
      }
    ]);
  });

  it('reports a dangling arrow before a blank line as malformed', () => {
    const result = analyzePatchbay(
      `
      [Message]
      Foo ->

      Bar
      `,
      {
        messageSources: new Set(['Foo']),
        messageTargets: new Set(['Bar'])
      }
    );

    expect(result.messageRoutes).toEqual([]);

    expect(result.diagnostics).toMatchObject([
      {
        severity: 'error',
        code: 'malformed-route',
        section: 'message',
        line: 3
      },
      {
        severity: 'error',
        code: 'malformed-route',
        section: 'message',
        line: 5
      }
    ]);
  });
});
