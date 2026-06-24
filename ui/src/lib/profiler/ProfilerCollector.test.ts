import { describe, expect, it } from 'vitest';
import { ProfilerCollector } from './ProfilerCollector';

describe('ProfilerCollector', () => {
  it('preserves last timing values when no calls occur in a flush window', () => {
    const collector = new ProfilerCollector();

    collector.record(2);
    collector.record(4);

    const active = collector.flush(performance.now() + 500);
    expect(active.avg).toBe(3);
    expect(active.max).toBe(4);
    expect(active.last).toBe(4);
    expect(active.callsPerSecond).toBeGreaterThan(0);

    const inactive = collector.flush(performance.now() + 1000);
    expect(inactive.avg).toBe(3);
    expect(inactive.max).toBe(4);
    expect(inactive.last).toBe(4);
    expect(inactive.callsPerSecond).toBe(0);
  });

  it('still returns zero stats before the first sample', () => {
    const collector = new ProfilerCollector();

    expect(collector.flush(performance.now() + 500)).toEqual({
      avg: 0,
      max: 0,
      p95: 0,
      last: 0,
      callsPerSecond: 0
    });
  });
});
