import { enabledPresetPackIds } from '../../stores/extensions.store';
import { loadEnabledPresetPacks } from '../../stores/preset-library.store';
import { logger } from '$lib/utils/logger';
import { fromStore } from 'svelte/store';

/** Keep optional presets available while a catalog is open, including newly enabled packs. */
export function useEnabledPresetPacks(getIsOpen: () => boolean) {
  const enabledPacks = fromStore(enabledPresetPackIds);

  $effect(() => {
    if (!getIsOpen()) return;

    void loadEnabledPresetPacks(enabledPacks.current).catch((error) => {
      logger.error('Failed to load enabled preset packs', error);
    });
  });
}
