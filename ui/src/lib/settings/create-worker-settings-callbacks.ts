import type { SettingsSchema } from './types';
import type { SettingsManager } from './SettingsManager';

/**
 * Creates the standard settings callback object used to bridge
 * a worker's `settings.define()` / `settings.set()` / `settings.clear()`
 * calls back to the main-thread SettingsManager.
 *
 * Used by both WorkerNode (js worker) and all GLSystem render nodes
 * (canvas, hydra, three, textmode, regl, swgl).
 */
export function createWorkerSettingsCallbacks(
  settingsManager: SettingsManager,
  sendValues: (requestId: string, values: Record<string, unknown>) => void
) {
  return {
    onDefine: async (requestId: string, schema: unknown[]) => {
      await settingsManager.define(schema as SettingsSchema);
      sendValues(requestId, settingsManager.getAll());
    },
    onSet: (key: string, value: unknown) => {
      settingsManager.setValue(key, value);
    },
    onClear: () => {
      settingsManager.clear();
    }
  };
}
