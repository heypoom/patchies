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
  let suppressNextSync = false;

  $effect(() => {
    const { name, params } = getData();

    if (!getAudioObjectNames().includes(name)) return;

    const key = JSON.stringify(params);
    if (lastSyncedKey === key) return;

    // Skip initial sync (handled by onMount)
    if (lastSyncedKey !== null) {
      // Skip sync if the param change was already forwarded to the audio node
      // (e.g., from an incoming message that called audioService.send directly).
      // Only external changes (undo/redo) should trigger a full node recreation.
      if (suppressNextSync) {
        suppressNextSync = false;
      } else {
        onSync(name, params);
      }
    }

    lastSyncedKey = key;
  });

  return {
    /** Mark the next params change as already handled (no node recreation needed). */
    suppress() {
      suppressNextSync = true;
    }
  };
}
