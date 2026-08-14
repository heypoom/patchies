import type { SettingsField, SettingsSchema } from './types';
import type { KVStore } from '$lib/storage/KVStore';
import { match } from 'ts-pattern';
import {
  cloneJsonValue,
  cloneSettingsFieldValue,
  jsonValuesEqual,
  normalizeSettingsSchema
} from './json';

type ChangeCallback = (key: string, value: unknown, allValues: Record<string, unknown>) => void;

/**
 * Manages user-defined settings values for a node across
 * all persistence levels:
 *
 * - 'node': stored in node.data.settings (exported with patch)
 * - 'kv': stored in IndexedDB via KVStore (local only, not exported)
 * - 'none': in-memory only (lost on reload)
 */
export class SettingsManager {
  /** Stores fields from define() so settings methods can find a field's persistence level. */
  private schema: SettingsField[] = [];

  /** Stores values with none persistence while the node runs. */
  private memoryStore: Map<string, unknown> = new Map();

  /** Caches KV values after the asynchronous load. */
  private kvCache: Map<string, unknown> = new Map();

  /** Stores callbacks that receive setting changes. */
  private changeCallbacks: ChangeCallback[] = [];

  /** Stores the last node snapshot to detect node data updates. */
  private lastReadNodeSettings: Record<string, unknown> | undefined;

  /** Holds node writes until the view provides updated node data. */
  private pendingNodeSettings: Record<string, unknown> | undefined;

  constructor(
    private getNodeSettings: () => Record<string, unknown>,

    private updateNodeSettings: (
      settings: Record<string, unknown>,
      fields: SettingsField[]
    ) => void,

    private kvStore: KVStore
  ) {}

  async define(fields: SettingsField[]): Promise<void> {
    this.schema = normalizeSettingsSchema(fields);

    // Load KV-persisted field values before returning
    for (const field of this.schema) {
      if (field.persistence === 'kv') {
        const value = await this.kvStore.get(`settings:${field.key}`);

        if (value !== undefined) {
          this.kvCache.set(field.key, value);
        }
      }
    }

    // Preserve existing node values, fill in defaults for new fields
    const currentSettings = this.getCurrentNodeSettings();
    const nextSettings: Record<string, unknown> = { ...currentSettings };

    for (const field of this.schema) {
      if (!field.persistence || field.persistence === 'node') {
        if (nextSettings[field.key] === undefined && field.default !== undefined) {
          nextSettings[field.key] = cloneSettingsFieldValue(field, field.default);
        }
      }
    }

    this.updateNodeSettingsWithCache(nextSettings, this.schema);
  }

  get(key: string): unknown {
    const field = this.schema.find((f) => f.key === key);
    if (!field) return undefined;

    const value = match(field.persistence ?? 'node')
      .with('none', () => this.memoryStore.get(key))
      .with('kv', () => this.kvCache.get(key))
      .with('node', () => this.getCurrentNodeSettings()[key])
      .exhaustive();

    const resolvedValue = value !== undefined ? value : field.default;
    return resolvedValue === undefined ? undefined : cloneSettingsFieldValue(field, resolvedValue);
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.schema.map((field) => [field.key, this.get(field.key)]));
  }

  /** Called when onChange() is registered — used to show active indicator */
  onChangeCallbackRegistered?: () => void;

  onChange(callback: ChangeCallback): void {
    this.changeCallbacks.push(callback);
    this.onChangeCallbackRegistered?.();
  }

  setValue(key: string, value: unknown): void {
    const field = this.schema.find((f) => f.key === key);
    if (!field) return;

    const storedValue = cloneSettingsFieldValue(field, value);

    match(field.persistence ?? 'node')
      .with('none', () => {
        this.memoryStore.set(key, storedValue);
      })
      .with('kv', () => {
        this.kvCache.set(key, storedValue);
        this.kvStore.set(`settings:${key}`, storedValue);
      })
      .with('node', () => {
        const settings = this.getCurrentNodeSettings();

        this.updateNodeSettingsWithCache({ ...settings, [key]: storedValue }, this.schema);
      })
      .exhaustive();

    // Fire onChange callbacks
    const settingsValues = this.getAll();

    for (const callback of this.changeCallbacks) {
      try {
        callback(key, cloneSettingsFieldValue(field, storedValue), settingsValues);
      } catch (error) {
        console.error('settings.onChange callback error:', error);
      }
    }
  }

  revertAll(): void {
    const newSettings: Record<string, unknown> = {};

    for (const field of this.schema) {
      const hasDefault = field.default !== undefined;

      match(field.persistence ?? 'node')
        .with('none', () => {
          if (hasDefault) {
            this.memoryStore.set(field.key, cloneSettingsFieldValue(field, field.default));
          } else {
            this.memoryStore.delete(field.key);
          }
        })
        .with('kv', () => {
          if (hasDefault) {
            const defaultValue = cloneSettingsFieldValue(field, field.default);
            this.kvCache.set(field.key, defaultValue);
            this.kvStore.set(`settings:${field.key}`, defaultValue);
          } else {
            this.kvCache.delete(field.key);
            this.kvStore.delete(`settings:${field.key}`);
          }
        })
        .with('node', () => {
          if (hasDefault) {
            newSettings[field.key] = cloneSettingsFieldValue(field, field.default);
          }
        })
        .exhaustive();
    }

    this.updateNodeSettingsWithCache(newSettings, this.schema);

    // Fire onChange for all fields
    const settingValues = this.getAll();

    for (const field of this.schema) {
      const value = settingValues[field.key];

      for (const callback of this.changeCallbacks) {
        try {
          callback(field.key, value, settingValues);
        } catch (e) {
          console.error('settings.onChange callback error:', e);
        }
      }
    }
  }

  clear(): void {
    this.memoryStore.clear();
    this.kvCache.clear();

    for (const field of this.schema) {
      if (field.persistence === 'kv') {
        this.kvStore.delete(`settings:${field.key}`);
      }
    }

    this.updateNodeSettingsWithCache({}, this.schema);
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

  private getCurrentNodeSettings(): Record<string, unknown> {
    const currentSettings = this.getNodeSettings();

    if (
      this.lastReadNodeSettings === undefined ||
      !areSettingsEqual(currentSettings, this.lastReadNodeSettings)
    ) {
      this.lastReadNodeSettings = { ...currentSettings };
      this.pendingNodeSettings = { ...currentSettings };
    }

    return this.pendingNodeSettings ?? currentSettings;
  }

  private updateNodeSettingsWithCache(
    settings: Record<string, unknown>,
    schema: SettingsSchema
  ): void {
    this.pendingNodeSettings = settings;
    this.updateNodeSettings(settings, schema);
  }

  /** True if any field with a default has a value different from it. */
  isDirty(): boolean {
    for (const field of this.schema) {
      if (field.default === undefined) continue;

      const current = this.get(field.key);
      const clonedJsonValue = current as ReturnType<typeof cloneJsonValue>;

      const hasChangedFromDefault =
        field.type === 'json'
          ? !jsonValuesEqual(clonedJsonValue, field.default)
          : current !== field.default;

      if (hasChangedFromDefault) {
        return true;
      }
    }

    return false;
  }
}

function areSettingsEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.is(left[key], right[key]))
  );
}
