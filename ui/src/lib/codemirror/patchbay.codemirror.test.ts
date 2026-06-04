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
        role: 'sender'
      },
      {
        from: 39,
        to: 45,
        className: 'cm-patchbay-channel-link cm-patchbay-receiver-channel',
        channel: 'Lights',
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
        role: 'both'
      },
      {
        from: 20,
        to: 26,
        className: 'cm-patchbay-channel-link cm-patchbay-receiver-channel',
        channel: 'Output',
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
      }).map(({ channel, role }) => ({ channel, role }))
    ).toEqual([
      { channel: 'Clock', role: 'sender' },
      { channel: 'Lights', role: 'receiver' }
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
});
