import { describe, expect, it } from 'vitest';

import { createWorkerSettingsProxy } from './workerSettingsProxy';

describe('worker settings proxy', () => {
  it('validates and snapshots JSON fields before posting writes', async () => {
    const messages: Array<Record<string, unknown>> = [];
    const proxy = createWorkerSettingsProxy('node-1', (message) =>
      messages.push(message as Record<string, unknown>)
    );

    const definition = proxy.settings.define([{ key: 'grid', type: 'json', default: [[false]] }]);
    const defineMessage = messages[0];
    proxy._receiveValuesInit(defineMessage.requestId as string, { grid: [[false]] });
    await definition;

    const readGrid = proxy.settings.get('grid') as boolean[][];
    readGrid[0][0] = true;
    expect(proxy.settings.get('grid')).toEqual([[false]]);

    expect(() => proxy.settings.set('grid', { invalid: undefined })).toThrow(TypeError);
    expect(messages).toHaveLength(1);

    const nextGrid = [[true, false]];
    proxy.settings.set('grid', nextGrid);
    nextGrid[0][1] = true;

    expect(messages[1]).toMatchObject({ type: 'settingsSet', key: 'grid', value: [[true, false]] });
    expect(proxy.settings.get('grid')).toEqual([[true, false]]);
  });
});
