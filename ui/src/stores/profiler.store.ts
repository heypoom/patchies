import { writable } from 'svelte/store';
import { profiler, ProfilerCoordinator, HOT_THRESHOLD_MS } from '$lib/profiler';
import type { ProfilerSnapshot } from '$lib/profiler';

export { HOT_THRESHOLD_MS };

export const profilerEnabled = writable(false);
export const profilerSnapshot = writable<ProfilerSnapshot | null>(null);

// Wire profiler.enabled boolean and start/stop the coordinator interval.
// Only runs in browser — profiler is never active during SSR.
if (typeof window !== 'undefined') {
  profilerEnabled.subscribe((enabled) => {
    profiler.enabled = enabled;

    ProfilerCoordinator.getInstance().notifyEnableChange(enabled);

    if (enabled) {
      ProfilerCoordinator.getInstance().start((snapshot) => {
        profilerSnapshot.set(snapshot);
      });
    } else {
      ProfilerCoordinator.getInstance().stop();
      profilerSnapshot.set(null);
    }
  });
}
