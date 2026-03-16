import type { SettingsSchema } from '$lib/settings/types';

type ChangeCallback = (key: string, value: unknown, allValues: Record<string, unknown>) => void;

export interface WorkerSettingsProxy {
  settings: {
    define(schema: SettingsSchema): Promise<void>;
    get(key: string): unknown;
    getAll(): Record<string, unknown>;
    onChange(callback: ChangeCallback): void;
    clear(): void;
  };

  /** Clear onChange callbacks — call before each code re-run. */
  _clearCallbacks(): void;

  /**
   * Reset state for a re-run: clears callbacks, pendingDefines, and cachedValues,
   * but preserves requestIdCounter to prevent request ID collisions across re-runs.
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
  let requestIdCounter = 0;
  let onChangeCallbacks: ChangeCallback[] = [];

  const settings = {
    async define(schema: SettingsSchema): Promise<void> {
      const requestId = `settings-${nodeId}-${++requestIdCounter}`;

      return new Promise<void>((resolve) => {
        pendingDefines.set(requestId, (values) => {
          cachedValues = values;
          resolve();
        });

        postMessage({ type: 'settingsDefine', nodeId, requestId, schema });
      });
    },

    get(key: string): unknown {
      return cachedValues[key];
    },

    getAll(): Record<string, unknown> {
      return { ...cachedValues };
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
      cachedValues = {};
    },

    _receiveValuesInit(requestId: string, values: Record<string, unknown>) {
      const resolve = pendingDefines.get(requestId);

      if (resolve) {
        pendingDefines.delete(requestId);
        resolve(values);
      }
    },

    _receiveValueChanged(key: string, value: unknown) {
      cachedValues[key] = value;

      const allValues = { ...cachedValues };

      for (const callback of onChangeCallbacks) {
        try {
          callback(key, value, allValues);
        } catch {
          // ignore callback errors
        }
      }
    }
  };
}
