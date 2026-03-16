import type { SettingsField, SettingsAPI } from './types';
import type { SettingsManager } from './SettingsManager';

/**
 * Creates the `settings` object injected into JSRunner-enabled nodes.
 * Wraps a SettingsManager instance with the public API surface.
 */
export function createSettingsAPI(manager: SettingsManager): SettingsAPI {
  return {
    async define(schema: SettingsField[]): Promise<void> {
      await manager.define(schema);
    },

    get(key: string): unknown {
      return manager.get(key);
    },

    getAll(): Record<string, unknown> {
      return manager.getAll();
    },

    set(key: string, value: unknown): void {
      manager.setValue(key, value);
    },

    onChange(
      callback: (key: string, value: unknown, allValues: Record<string, unknown>) => void
    ): void {
      manager.onChange(callback);
    },

    clear(): void {
      manager.clear();
    }
  };
}
