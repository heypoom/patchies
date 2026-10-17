import type { LegacyPresetsRecord } from './types';

/** Load optional payloads once, including when several catalog surfaces request them together. */
export function createPresetPackLoader({
  loaders,
  publish
}: {
  loaders: Record<string, () => Promise<LegacyPresetsRecord>>;
  publish: (presets: LegacyPresetsRecord) => void;
}) {
  const pending = new Map<string, Promise<void>>();

  return async (enabledPackIds: readonly string[]) => {
    await Promise.all(
      enabledPackIds.map((packId) => {
        const load = loaders[packId];
        if (!load) return;

        let promise = pending.get(packId);

        if (!promise) {
          promise = Promise.resolve()
            .then(load)
            .then(publish)
            .catch((error) => {
              pending.delete(packId);

              throw error;
            });

          pending.set(packId, promise);
        }

        return promise;
      })
    );
  };
}
