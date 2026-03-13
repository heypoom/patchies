import { writable } from 'svelte/store';
import { profiler, ProfilerCoordinator } from '$lib/profiler';
import type { ProfilerSnapshot } from '$lib/profiler';

export const profilerEnabled = writable(false);
export const profilerSnapshot = writable<ProfilerSnapshot | null>(null);

/** Rolling history of snapshots — last 60 entries (~30 seconds at 500ms intervals) */
export const profilerHistory = writable<ProfilerSnapshot[]>([]);

const MAX_CHART_HISTORY = 60;

// Wire profiler.enabled boolean and start/stop the coordinator interval.
// Only runs in browser — profiler is never active during SSR.
if (typeof window !== 'undefined') {
  profilerEnabled.subscribe((enabled) => {
    profiler.enabled = enabled;

    ProfilerCoordinator.getInstance().notifyEnableChange(enabled);

    if (enabled) {
      ProfilerCoordinator.getInstance().start((snapshot) => {
        profilerSnapshot.set(snapshot);
        profilerHistory.update((h) => {
          const next = [...h, snapshot];
          return next.length > MAX_CHART_HISTORY ? next.slice(-MAX_CHART_HISTORY) : next;
        });
      });
    } else {
      ProfilerCoordinator.getInstance().stop();
      // Keep snapshot and history frozen so the user can inspect results
    }
  });
}
