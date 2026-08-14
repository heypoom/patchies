import { describe, expect, it } from 'vitest';

import type { KVStore } from '$lib/storage';

import { SettingsManager } from './SettingsManager';
import { createSettingsAPI } from './create-settings-api';
import type { SettingsSchema } from './types';

const fakeKVStore = {
  get: async () => undefined,
  set: async () => {},
  delete: async () => false
} as unknown as KVStore;

describe('SettingsManager', () => {
  it('preserves earlier synchronous node-persisted settings updates', async () => {
    const persistedSettings: Record<string, unknown> = {};
    const updates: Record<string, unknown>[] = [];

    const manager = new SettingsManager(
      () => persistedSettings,
      (settings) => updates.push(settings),
      fakeKVStore
    );

    const settings = createSettingsAPI(manager);

    await settings.define([
      { key: 'x', label: 'X', type: 'number' },
      { key: 'y', label: 'Y', type: 'number' }
    ]);

    settings.set('x', 1);
    settings.set('y', 2);

    expect(updates.at(-1)).toEqual({ x: 1, y: 2 });
  });

  it('reverts every persistence level to its default', async () => {
    let persistedSettings: Record<string, unknown> = {};

    const manager = new SettingsManager(
      () => persistedSettings,
      (settings) => {
        persistedSettings = settings;
      },
      fakeKVStore
    );

    await manager.define([
      { key: 'node', label: 'Node', type: 'number', default: 1 },
      { key: 'kv', label: 'KV', type: 'number', persistence: 'kv', default: 2 },
      { key: 'none', label: 'None', type: 'number', persistence: 'none', default: 3 },
      { key: 'jsonNode', type: 'json', default: { enabled: true } },
      { key: 'jsonKv', type: 'json', persistence: 'kv', default: { enabled: true } },
      { key: 'jsonNone', type: 'json', persistence: 'none', default: { enabled: true } }
    ]);

    manager.setValue('node', 10);
    manager.setValue('kv', 20);
    manager.setValue('none', 30);
    manager.setValue('jsonNode', { enabled: false });
    manager.setValue('jsonKv', { enabled: false });
    manager.setValue('jsonNone', { enabled: false });
    manager.revertAll();

    expect(manager.getAll()).toEqual({
      node: 1,
      kv: 2,
      none: 3,
      jsonNode: { enabled: true },
      jsonKv: { enabled: true },
      jsonNone: { enabled: true }
    });
  });

  it('persists JSON values as isolated snapshots', async () => {
    let persistedSettings: Record<string, unknown> = {};
    const manager = new SettingsManager(
      () => persistedSettings,
      (settings) => {
        persistedSettings = settings;
      },
      fakeKVStore
    );

    await manager.define([{ key: 'grid', type: 'json', default: [[false, true]] }]);

    const defaultGrid = manager.get('grid') as boolean[][];
    defaultGrid[0][0] = true;
    expect(manager.get('grid')).toEqual([[false, true]]);

    const nextGrid = [[true, false]];
    manager.onChange((_key, value, allValues) => {
      (value as boolean[][])[0][0] = false;
      (allValues.grid as boolean[][])[0][1] = true;
    });
    manager.setValue('grid', nextGrid);
    nextGrid[0][1] = true;

    expect(persistedSettings).toEqual({ grid: [[true, false]] });
    expect(manager.get('grid')).toEqual([[true, false]]);
  });

  it('rejects values that cannot round-trip through JSON', async () => {
    const manager = new SettingsManager(
      () => ({}),
      () => {},
      fakeKVStore
    );

    await manager.define([{ key: 'data', type: 'json' }]);

    expect(() => manager.setValue('data', { invalid: undefined })).toThrow(TypeError);
    expect(() => manager.setValue('data', new Map())).toThrow(TypeError);
    expect(() => manager.setValue('data', Infinity)).toThrow(TypeError);
    const invalidSchema = [
      { key: 'invalidDefault', type: 'json', default: { invalid: undefined } }
    ] as unknown as SettingsSchema;
    await expect(manager.define(invalidSchema)).rejects.toThrow(TypeError);
  });
});
