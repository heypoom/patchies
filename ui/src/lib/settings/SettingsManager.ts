import type { SettingsField, SettingsSchema } from './types';
import type { KVStore } from '$lib/storage/KVStore';

type ChangeCallback = (key: string, value: unknown, allValues: Record<string, unknown>) => void;

/**
 * Manages settings values for a node across all persistence levels:
 * - 'node': stored in node.data.settings (exported with patch)
 * - 'kv': stored in IndexedDB via KVStore (local only, not exported)
 * - 'none': in-memory only (lost on reload)
 */
export class SettingsManager {
  private schema: SettingsSchema = [];
  private noneValues: Map<string, unknown> = new Map();
  private kvCache: Map<string, unknown> = new Map();
  private changeCallbacks: ChangeCallback[] = [];

  constructor(
    private getNodeSettings: () => Record<string, unknown>,
    private updateNodeSettings: (settings: Record<string, unknown>, schema: SettingsSchema) => void,
    private kvStore: KVStore
  ) {}

  async define(schema: SettingsSchema): Promise<void> {
    this.schema = schema;

    // Load KV values asynchronously before returning
    for (const field of schema) {
      if (field.persistence === 'kv') {
        const value = await this.kvStore.get(`settings:${field.key}`);
        if (value !== undefined) {
          this.kvCache.set(field.key, value);
        }
      }
    }

    // Preserve existing node values, fill in defaults for new fields
    const existingSettings = this.getNodeSettings();
    const newSettings: Record<string, unknown> = { ...existingSettings };

    for (const field of schema) {
      const persistence = field.persistence ?? 'node';
      if (
        persistence === 'node' &&
        newSettings[field.key] === undefined &&
        field.default !== undefined
      ) {
        newSettings[field.key] = field.default;
      }
    }

    this.updateNodeSettings(newSettings, schema);
  }

  get(key: string): unknown {
    const field = this.schema.find((f) => f.key === key);
    if (!field) return undefined;

    const persistence = field.persistence ?? 'node';

    if (persistence === 'none') {
      const val = this.noneValues.get(key);
      return val !== undefined ? val : field.default;
    }

    if (persistence === 'kv') {
      const val = this.kvCache.get(key);
      return val !== undefined ? val : field.default;
    }

    // 'node' persistence
    const nodeSettings = this.getNodeSettings();
    const val = nodeSettings[key];
    return val !== undefined ? val : field.default;
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.schema.map((field) => [field.key, this.get(field.key)]));
  }

  onChange(callback: ChangeCallback): void {
    this.changeCallbacks.push(callback);
  }

  setValue(key: string, value: unknown): void {
    const field = this.schema.find((f) => f.key === key);
    if (!field) return;

    const persistence = field.persistence ?? 'node';

    if (persistence === 'none') {
      this.noneValues.set(key, value);
    } else if (persistence === 'kv') {
      this.kvCache.set(key, value);
      this.kvStore.set(`settings:${key}`, value);
    } else {
      const nodeSettings = this.getNodeSettings();
      this.updateNodeSettings({ ...nodeSettings, [key]: value }, this.schema);
    }

    // Fire onChange callbacks
    const allValues = this.getAll();
    for (const cb of this.changeCallbacks) {
      try {
        cb(key, value, allValues);
      } catch (e) {
        console.error('settings.onChange callback error:', e);
      }
    }
  }

  revertAll(): void {
    const newSettings: Record<string, unknown> = {};

    for (const field of this.schema) {
      const persistence = field.persistence ?? 'node';

      if (persistence === 'none') {
        if (field.default !== undefined) {
          this.noneValues.set(field.key, field.default);
        } else {
          this.noneValues.delete(field.key);
        }
      } else if (persistence === 'kv') {
        if (field.default !== undefined) {
          this.kvCache.set(field.key, field.default);
          this.kvStore.set(`settings:${field.key}`, field.default);
        } else {
          this.kvCache.delete(field.key);
          this.kvStore.delete(`settings:${field.key}`);
        }
      } else {
        if (field.default !== undefined) {
          newSettings[field.key] = field.default;
        }
      }
    }

    this.updateNodeSettings(newSettings, this.schema);

    // Fire onChange for all fields
    const allValues = this.getAll();
    for (const field of this.schema) {
      const value = allValues[field.key];
      for (const cb of this.changeCallbacks) {
        try {
          cb(field.key, value, allValues);
        } catch (e) {
          console.error('settings.onChange callback error:', e);
        }
      }
    }
  }

  clear(): void {
    this.noneValues.clear();
    this.kvCache.clear();

    for (const field of this.schema) {
      if (field.persistence === 'kv') {
        this.kvStore.delete(`settings:${field.key}`);
      }
    }

    this.updateNodeSettings({}, this.schema);
  }

  /** Clear onChange callbacks. Called before each code re-run. */
  clearCallbacks(): void {
    this.changeCallbacks = [];
  }

  getSchema(): SettingsSchema {
    return this.schema;
  }

  hasSchema(): boolean {
    return this.schema.length > 0;
  }

  /** True if any field with a default has a value different from it. */
  isDirty(): boolean {
    for (const field of this.schema) {
      if (field.default === undefined) continue;
      const current = this.get(field.key);
      if (current !== field.default) return true;
    }
    return false;
  }
}
