import { describe, expect, it } from 'vitest';

import type { KVStore } from '$lib/storage';

import { SettingsManager } from './SettingsManager';
import { createSettingsAPI } from './create-settings-api';

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
      { key: 'none', label: 'None', type: 'number', persistence: 'none', default: 3 }
    ]);

    manager.setValue('node', 10);
    manager.setValue('kv', 20);
    manager.setValue('none', 30);
    manager.revertAll();

    expect(manager.getAll()).toEqual({ node: 1, kv: 2, none: 3 });
  });
});
