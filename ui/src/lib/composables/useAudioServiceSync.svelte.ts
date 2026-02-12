import { getAudioObjectNames } from '$lib/audio/v2/audio-helpers';

/**
 * Composable to sync AudioService when node data changes externally (e.g., via undo/redo).
 *
 * Usage:
 * ```svelte
 * useAudioServiceSync(
 *   () => ({ name: data.name, params: data.params }),
 *   (name, params) => {
 *     syncAudioService(name, params);
 *     objectInstanceVersion++;
 *   }
 * );
 * ```
 */
export function useAudioServiceSync(
  getData: () => { name: string; params: unknown[] },
  onSync: (name: string, params: unknown[]) => void
) {
  let lastSyncedKey: string | null = $state(null);

  $effect(() => {
    const { name, params } = getData();

    if (!getAudioObjectNames().includes(name)) return;

    const key = JSON.stringify(params);
    if (lastSyncedKey === key) return;

    // Skip initial sync (handled by onMount)
    if (lastSyncedKey !== null) {
      onSync(name, params);
    }

    lastSyncedKey = key;
  });
}
