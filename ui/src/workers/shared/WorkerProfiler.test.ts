import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProfilerCategory, TimingStats } from '$lib/profiler/types';
import { WorkerProfiler } from './WorkerProfiler';

interface Flush {
  nodeId: string;
  category: ProfilerCategory;
  stats: TimingStats;
}

describe('WorkerProfiler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes an inactive zero-rate sample with preserved timings', () => {
    vi.useFakeTimers();

    const flushes: Flush[] = [];

    const profiler = new WorkerProfiler((nodeId, category, stats) => {
      flushes.push({ nodeId, category, stats });
    });

    profiler.setEnabled(true);

    profiler.measure('glsl-1', 'draw', () => {
      vi.advanceTimersByTime(2);
    });

    vi.advanceTimersByTime(498);
    expect(flushes).toHaveLength(1);

    expect(flushes[0]).toMatchObject({
      nodeId: 'glsl-1',
      category: 'draw',
      stats: { avg: 2, max: 2, last: 2 }
    });

    expect(flushes[0].stats.callsPerSecond).toBeGreaterThan(0);

    vi.advanceTimersByTime(500);
    expect(flushes).toHaveLength(2);

    expect(flushes[1]).toMatchObject({
      nodeId: 'glsl-1',
      category: 'draw',
      stats: { avg: 2, max: 2, last: 2, callsPerSecond: 0 }
    });

    profiler.setEnabled(false);
  });
});
