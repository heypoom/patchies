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
});
