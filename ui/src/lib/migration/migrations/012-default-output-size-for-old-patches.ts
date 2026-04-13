import type { Migration, RawPatchData } from '../types';

/**
 * Old patches without an explicit outputSize were created when the default was 1008×654.
 * Now that the default is 1280×720, we inject the old default so existing patches
 * don't change layout.
 */

const OLD_DEFAULT_OUTPUT_SIZE: [number, number] = [1008, 654];

export const migration012: Migration = {
  version: 12,
  name: 'default-output-size-for-old-patches',
  migrate(patch: RawPatchData): RawPatchData {
    if (patch.settings?.outputSize) return patch;

    return {
      ...patch,
      settings: {
        ...patch.settings,
        outputSize: OLD_DEFAULT_OUTPUT_SIZE
      }
    };
  }
};
