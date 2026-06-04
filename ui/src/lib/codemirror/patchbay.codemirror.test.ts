import { describe, expect, it } from 'vitest';

import { analyzePatchbay } from '$lib/patchbay/patchbay-parser';
import {
  getPatchbayChannelLinkRanges,
  getPatchbayDiagnosticRanges,
  getPatchbayLocalChannelRanges,
  tokenizePatchbayLine
} from './patchbay.codemirror';

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
