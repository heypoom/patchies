import type { SettingsSchema } from '$lib/settings/types';
import { cloneSettingsFieldValue, normalizeSettingsSchema } from '$lib/settings/json';

type ChangeCallback = (key: string, value: unknown, allValues: Record<string, unknown>) => void;

export interface WorkerSettingsProxy {
  settings: {
    define(schema: SettingsSchema): Promise<void>;
    get(key: string): unknown;
    getAll(): Record<string, unknown>;
    set(key: string, value: unknown): void;
    onChange(callback: ChangeCallback): void;
    clear(): void;
  };

  /** Clear onChange callbacks — call before each code re-run. */
  _clearCallbacks(): void;

  /**
   * Reset callbacks and pending definitions for a re-run while keeping the last
   * resolved values available until the next definition completes.
   */
  _reset(): void;

  /** Called when main thread sends back resolved values after define(). */
  _receiveValuesInit(requestId: string, values: Record<string, unknown>): void;

  /** Called when a UI value change is forwarded from the main thread. */
  _receiveValueChanged(key: string, value: unknown): void;
}

/**
 * Creates the `settings` object injected into worker code (js worker + render workers).
 * Communicates with the main thread via postMessage — define() is async because
 * the main thread needs to load KV values and merge defaults before responding.
 */
export function createWorkerSettingsProxy(
  nodeId: string,
  postMessage: (msg: object) => void
): WorkerSettingsProxy {
  const pendingDefines = new Map<string, (values: Record<string, unknown>) => void>();

  let cachedValues: Record<string, unknown> = {};
  let schema: SettingsSchema = [];
  let requestIdCounter = 0;
  let onChangeCallbacks: ChangeCallback[] = [];

  const notifyValueChanged = (key: string, value: unknown) => {
    const field = schema.find((candidate) => candidate.key === key);
    cachedValues[key] = field ? cloneSettingsFieldValue(field, value) : value;

    const callbackValue = settings.get(key);
    const allValues = settings.getAll();

    for (const callback of onChangeCallbacks) {
      try {
        callback(key, callbackValue, allValues);
      } catch {
        // ignore callback errors
      }
    }
  };

  const settings = {
    async define(nextSchema: SettingsSchema): Promise<void> {
      const requestId = `settings-${nodeId}-${++requestIdCounter}`;
      const normalizedSchema = normalizeSettingsSchema(nextSchema);

      schema = normalizedSchema;

      return new Promise<void>((resolve) => {
        pendingDefines.set(requestId, () => resolve());

        postMessage({ type: 'settingsDefine', nodeId, requestId, schema: normalizedSchema });
      });
    },

    get(key: string): unknown {
      const field = schema.find((candidate) => candidate.key === key);
      const value = cachedValues[key];

      return field && value !== undefined ? cloneSettingsFieldValue(field, value) : value;
    },

    getAll(): Record<string, unknown> {
      return Object.fromEntries(Object.keys(cachedValues).map((key) => [key, settings.get(key)]));
    },

    set(key: string, value: unknown): void {
      const field = schema.find((candidate) => candidate.key === key);
      const storedValue = field ? cloneSettingsFieldValue(field, value) : value;

      notifyValueChanged(key, storedValue);
      postMessage({ type: 'settingsSet', nodeId, key, value: storedValue });
    },

    onChange(callback: ChangeCallback): void {
      onChangeCallbacks.push(callback);
    },

    clear(): void {
      cachedValues = {};
      postMessage({ type: 'settingsClear', nodeId });
    }
  };

  return {
    settings,

    _clearCallbacks() {
      onChangeCallbacks = [];
    },

    _reset() {
      onChangeCallbacks = [];

      for (const resolve of pendingDefines.values()) {
        resolve(cachedValues);
      }

      pendingDefines.clear();
    },

    _receiveValuesInit(requestId: string, values: Record<string, unknown>) {
      const resolve = pendingDefines.get(requestId);

      if (resolve) {
        cachedValues = Object.fromEntries(
          Object.entries(values).map(([key, value]) => {
            const field = schema.find((candidate) => candidate.key === key);

            return [key, field ? cloneSettingsFieldValue(field, value) : value];
          })
        );

        pendingDefines.delete(requestId);
        resolve(values);
      }
    },

    _receiveValueChanged(key: string, value: unknown) {
      notifyValueChanged(key, value);
    }
  };
}
