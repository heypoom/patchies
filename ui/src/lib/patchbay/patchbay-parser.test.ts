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
