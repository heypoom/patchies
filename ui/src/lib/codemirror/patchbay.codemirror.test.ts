import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import { analyzePatchbay } from '$lib/patchbay/patchbay-parser';
import {
  patchbaySectionCompletions,
  patchbayContextualCompletions,
  getPatchbayChannelLinkRanges,
  getPatchbayDiagnosticRanges,
  getPatchbayLocalChannelRanges,
  getPatchbayObjectAssignmentRanges,
  getPatchbayObjectAliasHintRanges,
  getPatchbayObjectIdRanges,
  getPatchbayObjectKeywordRanges,
  getPatchbayObjectLinkRanges,
  getPatchbayObjectNameRanges,
  tokenizePatchbayLine
} from './patchbay.codemirror';

import type { PatchbayObjectPorts } from '$lib/patchbay/patchbay-parser';

function getPatchbayCompletionLabels(doc: string) {
  const state = EditorState.create({ doc });
  const context = new CompletionContext(state, doc.length, true);
  const result = patchbaySectionCompletions(context);

  return result?.options.map((option) => option.label) ?? [];
}

function getPatchbayContextualCompletionLabels(
  doc: string,
  options: Parameters<typeof patchbayContextualCompletions>[1]
) {
  const cursorIndex = doc.indexOf('|');
  const source = cursorIndex === -1 ? doc : doc.slice(0, cursorIndex) + doc.slice(cursorIndex + 1);
  const position = cursorIndex === -1 ? source.length : cursorIndex;
  const state = EditorState.create({ doc: source });
  const context = new CompletionContext(state, position, true);
  const result = patchbayContextualCompletions(context, options);

  return result?.options.map((option) => option.label) ?? [];
}

function getPatchbayContextualCompletions(
  doc: string,
  options: Parameters<typeof patchbayContextualCompletions>[1]
) {
  const cursorIndex = doc.indexOf('|');
  const source = cursorIndex === -1 ? doc : doc.slice(0, cursorIndex) + doc.slice(cursorIndex + 1);
  const position = cursorIndex === -1 ? source.length : cursorIndex;
  const state = EditorState.create({ doc: source });
  const context = new CompletionContext(state, position, true);

  return patchbayContextualCompletions(context, options)?.options ?? [];
}

describe('tokenizePatchbayLine', () => {
  it('classifies section headers, channel declarations, routes, and comments', () => {
    expect(tokenizePatchbayLine('[Message]')).toEqual([{ text: '[Message]', style: 'typeName' }]);

    expect(tokenizePatchbayLine('chan Logger')).toEqual([
      { text: 'chan', style: 'keyword' },
      { text: 'Logger', style: 'variableName' }
    ]);

    expect(tokenizePatchbayLine('Clock -> Logger // route')).toEqual([
      { text: 'Clock', style: 'variableName' },
      { text: '->', style: 'operator' },
      { text: 'Logger', style: 'variableName' },
      { text: '// route', style: 'comment' }
    ]);

    expect(tokenizePatchbayLine('Clock -> obj glsl-34:0')).toEqual([
      { text: 'Clock', style: 'variableName' },
      { text: '->', style: 'operator' },
      { text: 'obj', style: 'keyword' },
      { text: 'glsl-34:0', style: 'variableName' }
    ]);

    expect(tokenizePatchbayLine('Edge = obj glsl-34')).toEqual([
      { text: 'Edge', style: 'variableName' },
      { text: '=', style: 'operator' },
      { text: 'obj', style: 'keyword' },
      { text: 'glsl-34', style: 'variableName' }
    ]);
  });

  it('returns inline ranges for unknown channel diagnostics', () => {
    const source = `[Message]
chan Clock
Clock -> Missing -> MissingAgain`;
    const analysis = analyzePatchbay(source);

    expect(getPatchbayDiagnosticRanges(source, analysis.diagnostics)).toEqual([
      {
        from: 30,
        to: 37,
        className: 'cm-patchbay-unknown-channel',
        message:
          'Unknown message channel "Missing". Declare it with chan Missing or create a matching message channel object.'
      },
      {
        from: 41,
        to: 53,
        className: 'cm-patchbay-unknown-channel',
        message:
          'Unknown message channel "MissingAgain". Declare it with chan MissingAgain or create a matching message channel object.'
      }
    ]);
  });

  it('returns role-specific link ranges for registry-known channels only', () => {
    const source = `[Message]
chan Local
Clock -> Local -> Lights`;

    expect(
      getPatchbayChannelLinkRanges(source, {
        senders: new Set(['Clock']),
        receivers: new Set(['Lights'])
      })
    ).toEqual([
      {
        from: 21,
        to: 26,
        className: 'cm-patchbay-channel-link cm-patchbay-sender-channel',
        channel: 'Clock',
        section: 'message',
        role: 'sender'
      },
      {
        from: 39,
        to: 45,
        className: 'cm-patchbay-channel-link cm-patchbay-receiver-channel',
        channel: 'Lights',
        section: 'message',
        role: 'receiver'
      }
    ]);
  });

  it('uses a distinct class for channels registered as both sender and receiver', () => {
    const source = `[Message]
Shared -> Output`;

    expect(
      getPatchbayChannelLinkRanges(source, {
        senders: new Set(['Shared']),
        receivers: new Set(['Shared', 'Output'])
      })
    ).toEqual([
      {
        from: 10,
        to: 16,
        className: 'cm-patchbay-channel-link cm-patchbay-bidirectional-channel',
        channel: 'Shared',
        section: 'message',
        role: 'both'
      },
      {
        from: 20,
        to: 26,
        className: 'cm-patchbay-channel-link cm-patchbay-receiver-channel',
        channel: 'Output',
        section: 'message',
        role: 'receiver'
      }
    ]);
  });

  it('does not return role color ranges for inline declared passthrough channels', () => {
    const source = `[Message]
chan Local
Clock -> Local -> Lights`;

    expect(
      getPatchbayChannelLinkRanges(source, {
        senders: new Set(['Clock', 'Local']),
        receivers: new Set(['Local', 'Lights'])
      }).map(({ channel, section, role }) => ({ channel, section, role }))
    ).toEqual([
      { channel: 'Clock', section: 'message', role: 'sender' },
      { channel: 'Lights', section: 'message', role: 'receiver' }
    ]);
  });

  it('uses section-specific channel roles for audio ranges', () => {
    const source = `[Message]
foo -> bar

[Audio]
foo -> bar

[Video]
foo -> bar`;

    expect(
      getPatchbayChannelLinkRanges(source, {
        message: {
          senders: new Set(['foo']),
          receivers: new Set(['bar'])
        },
        audio: {
          senders: new Set(['bar']),
          receivers: new Set(['foo'])
        },
        video: {
          senders: new Set(['foo']),
          receivers: new Set(['bar'])
        }
      }).map(({ channel, section, role }) => ({ channel, section, role }))
    ).toEqual([
      { channel: 'foo', section: 'message', role: 'sender' },
      { channel: 'bar', section: 'message', role: 'receiver' },
      { channel: 'foo', section: 'audio', role: 'receiver' },
      { channel: 'bar', section: 'audio', role: 'sender' },
      { channel: 'foo', section: 'video', role: 'sender' },
      { channel: 'bar', section: 'video', role: 'receiver' }
    ]);
  });

  it('returns grey syntax ranges for inline declared passthrough channels', () => {
    const source = `[Message]
chan Local
Clock -> Local -> Lights`;

    expect(getPatchbayLocalChannelRanges(source)).toEqual([
      {
        from: 15,
        to: 20,
        className: 'cm-patchbay-local-channel'
      },
      {
        from: 30,
        to: 35,
        className: 'cm-patchbay-local-channel'
      }
    ]);
  });

  it('returns inline ranges for wrong channel role diagnostics', () => {
    const source = `[Message]
chan Bus
Inbound -> Bus
Bus -> Outbound`;
    const analysis = analyzePatchbay(source, {
      messageSources: new Set(['Outbound']),
      messageTargets: new Set(['Inbound'])
    });

    expect(getPatchbayDiagnosticRanges(source, analysis.diagnostics)).toEqual([
      {
        from: 19,
        to: 26,
        className: 'cm-patchbay-role-error',
        message:
          'Message channel "Inbound" is registered as a receiver, so it cannot be used as a route source.'
      },
      {
        from: 41,
        to: 49,
        className: 'cm-patchbay-role-error',
        message:
          'Message channel "Outbound" is registered as a sender, so it cannot be used as a route target.'
      }
    ]);
  });

  it('does not return channel link ranges for object ids', () => {
    const source = `[Video]
Camera -> obj glsl-34:0`;

    expect(
      getPatchbayChannelLinkRanges(source, {
        video: {
          senders: new Set(['Camera', 'glsl-34:0']),
          receivers: new Set(['glsl-34:0'])
        }
      }).map(({ channel, section, role }) => ({ channel, section, role }))
    ).toEqual([{ channel: 'Camera', section: 'video', role: 'sender' }]);
  });

  it('returns object link ranges for explicit object references', () => {
    const source = `[Video]
Camera -> obj glsl-34:0
obj hydra-12 -> Output`;

    expect(getPatchbayObjectLinkRanges(source)).toEqual([
      {
        from: 22,
        to: 29,
        className: 'cm-patchbay-object-link',
        nodeId: 'glsl-34'
      },
      {
        from: 36,
        to: 44,
        className: 'cm-patchbay-object-link',
        nodeId: 'hydra-12'
      }
    ]);
  });

  it('returns object link ranges for object alias references', () => {
    const source = `[Video]
Camera -> Edge -> Aber
Edge = obj glsl-34`;

    expect(getPatchbayObjectLinkRanges(source)).toEqual([
      {
        from: 18,
        to: 22,
        className: 'cm-patchbay-object-link',
        nodeId: 'glsl-34'
      },
      {
        from: 31,
        to: 35,
        className: 'cm-patchbay-object-link',
        nodeId: 'glsl-34'
      },
      {
        from: 42,
        to: 49,
        className: 'cm-patchbay-object-link',
        nodeId: 'glsl-34'
      }
    ]);
  });

  it('returns distinct syntax ranges for object alias declarations', () => {
    const source = `[Video]
chan Out
Src = obj hydra-39
Edge = obj glsl-34
Src -> Out`;

    expect(getPatchbayObjectNameRanges(source)).toEqual([
      {
        from: 17,
        to: 20,
        className: 'cm-patchbay-object-name'
      },
      {
        from: 36,
        to: 40,
        className: 'cm-patchbay-object-name'
      },
      {
        from: 55,
        to: 58,
        className: 'cm-patchbay-object-name'
      }
    ]);

    expect(getPatchbayObjectAssignmentRanges(source)).toEqual([
      {
        from: 21,
        to: 22,
        className: 'cm-patchbay-object-assignment'
      },
      {
        from: 41,
        to: 42,
        className: 'cm-patchbay-object-assignment'
      }
    ]);

    expect(getPatchbayObjectKeywordRanges(source)).toEqual([
      {
        from: 23,
        to: 26,
        className: 'cm-patchbay-object-keyword'
      },
      {
        from: 43,
        to: 46,
        className: 'cm-patchbay-object-keyword'
      }
    ]);

    expect(getPatchbayObjectIdRanges(source)).toEqual([
      {
        from: 27,
        to: 35,
        className: 'cm-patchbay-object-id'
      },
      {
        from: 47,
        to: 54,
        className: 'cm-patchbay-object-id'
      }
    ]);
  });

  it('returns hover hint ranges for object alias definitions and usages', () => {
    const source = `[Video]
Edge = obj glsl-6
Noise = obj glsl-5
Noise -> Edge`;

    expect(getPatchbayObjectAliasHintRanges(source).map(({ hoverText }) => hoverText)).toEqual([
      'Edge = obj glsl-6',
      'Noise = obj glsl-5',
      'Noise = obj glsl-5',
      'Edge = obj glsl-6'
    ]);
  });

  it('does not return channel link ranges for object aliases', () => {
    const source = `[Video]
Camera -> Edge
Edge = obj glsl-34`;

    expect(
      getPatchbayChannelLinkRanges(source, {
        video: {
          senders: new Set(['Camera', 'Edge']),
          receivers: new Set(['Edge'])
        }
      }).map(({ channel, section, role }) => ({ channel, section, role }))
    ).toEqual([{ channel: 'Camera', section: 'video', role: 'sender' }]);
  });

  it('returns inline ranges for object diagnostics', () => {
    const source = `[Audio]
obj missing-1 -> obj gain-2:3`;
    const analysis = analyzePatchbay(source, {
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
    });

    expect(getPatchbayDiagnosticRanges(source, analysis.diagnostics)).toEqual([
      {
        from: 12,
        to: 21,
        className: 'cm-patchbay-role-error',
        message: 'Unknown object "missing-1". Use an existing object id after obj.'
      },
      {
        from: 29,
        to: 37,
        className: 'cm-patchbay-role-error',
        message: 'Object "gain-2" has no audio inlet at compatible port 3.'
      }
    ]);
  });

  it('returns inline ranges on multiline route continuation lines', () => {
    const source = `[Message]
Src
-> Missing`;
    const analysis = analyzePatchbay(source, {
      messageSources: new Set(['Src'])
    });

    expect(getPatchbayDiagnosticRanges(source, analysis.diagnostics)).toEqual([
      {
        from: 17,
        to: 24,
        className: 'cm-patchbay-unknown-channel',
        message:
          'Unknown message channel "Missing". Declare it with chan Missing or create a matching message channel object.'
      }
    ]);
  });
});

describe('patchbaySectionCompletions', () => {
  it('suggests patchbay sections when typing an opening bracket at the start of a line', () => {
    expect(getPatchbayCompletionLabels('[')).toEqual(['[Audio]', '[Video]', '[Message]']);
    expect(getPatchbayCompletionLabels('[A')).toEqual(['[Audio]']);
    expect(getPatchbayCompletionLabels('Clock -> [')).toEqual([]);
    expect(getPatchbayCompletionLabels('[Message]\n[')).toEqual([
      '[Audio]',
      '[Video]',
      '[Message]'
    ]);
  });

  it('suggests obj only where an endpoint or alias target can start', () => {
    expect(getPatchbayCompletionLabels('o')).toEqual(['obj']);
    expect(getPatchbayCompletionLabels('obj')).toEqual(['obj']);
    expect(getPatchbayCompletionLabels('src = o')).toEqual(['obj']);
    expect(getPatchbayCompletionLabels('src -> o')).toEqual(['obj']);
    expect(getPatchbayCompletionLabels('obj slider-43 -> o')).toEqual(['obj']);

    expect(getPatchbayCompletionLabels('src o')).toEqual([]);
    expect(getPatchbayCompletionLabels('slider-43 o')).toEqual([]);
    expect(getPatchbayCompletionLabels('src obj =')).toEqual([]);
    expect(getPatchbayCompletionLabels('slider-43 obj ->')).toEqual([]);
  });
});

describe('patchbayContextualCompletions', () => {
  it('suggests channels for the current section endpoint position', () => {
    expect(
      getPatchbayContextualCompletionLabels('[Audio]\nKi', {
        channels: {
          audio: {
            senders: new Set(['Kick']),
            receivers: new Set(['Reverb'])
          },
          video: {
            senders: new Set(['Kinect']),
            receivers: new Set()
          }
        }
      })
    ).toEqual(['Kick']);

    expect(
      getPatchbayContextualCompletionLabels('[Audio]\nKick -> Re', {
        channels: {
          audio: {
            senders: new Set(['Kick']),
            receivers: new Set(['Reverb'])
          }
        }
      })
    ).toEqual(['Reverb']);
  });

  it('suggests declared local channels in endpoint positions', () => {
    expect(
      getPatchbayContextualCompletionLabels('[Message]\nchan Logger\nClock -> Lo', {
        channels: {
          message: {
            senders: new Set(['Clock']),
            receivers: new Set()
          }
        }
      })
    ).toEqual(['Logger']);
  });

  it('suggests object aliases in endpoint positions', () => {
    expect(
      getPatchbayContextualCompletionLabels(
        '[Video]\nEdge = obj glsl-6\nNoise = obj glsl-5\nChroma = obj glsl-7\nNo',
        {
          channels: {}
        }
      )
    ).toEqual(['Noise']);

    expect(
      getPatchbayContextualCompletions(
        '[Video]\nEdge = obj glsl-6\nNoise = obj glsl-5\nChroma = obj glsl-7\nNo',
        {
          channels: {}
        }
      )[0]?.detail
    ).toBe('glsl-5');

    expect(
      getPatchbayContextualCompletionLabels(
        '[Video]\nEdge = obj glsl-6\nNoise = obj glsl-5\nChroma = obj glsl-7\nNoise -> Ch',
        {
          channels: {}
        }
      )
    ).toEqual(['Chroma']);
  });

  it('suggests compatible object ids after obj', () => {
    const objects: PatchbayObjectPorts = new Map([
      ['hydra-1', { video: { outlets: ['video-out'], inlets: [] } }],
      ['glsl-2', { video: { outlets: ['video-out'], inlets: ['video-in'] } }],
      ['scope-3', { audio: { outlets: [], inlets: ['audio-in'] } }]
    ]);

    expect(
      getPatchbayContextualCompletionLabels('[Video]\nobj h', {
        channels: {},
        objects
      })
    ).toEqual(['hydra-1']);

    expect(
      getPatchbayContextualCompletionLabels('[Video]\nSource -> obj g', {
        channels: {},
        objects
      })
    ).toEqual(['glsl-2']);

    expect(
      getPatchbayContextualCompletionLabels('[Video]\nSource -> obj g| -> Out', {
        channels: {},
        objects
      })
    ).toEqual(['glsl-2']);
  });

  it('suggests any section-compatible object id for alias declarations', () => {
    const objects: PatchbayObjectPorts = new Map([
      ['hydra-1', { video: { outlets: ['video-out'], inlets: [] } }],
      ['glsl-2', { video: { outlets: ['video-out'], inlets: ['video-in'] } }],
      ['scope-3', { audio: { outlets: [], inlets: ['audio-in'] } }]
    ]);

    expect(
      getPatchbayContextualCompletionLabels('[Video]\nSource = obj ', {
        channels: {},
        objects
      })
    ).toEqual(['hydra-1', 'glsl-2']);
  });
});
