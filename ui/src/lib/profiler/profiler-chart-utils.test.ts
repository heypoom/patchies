import { describe, expect, it } from 'vitest';
import type { ProfilerSnapshot, TimingStats } from './types';
import {
  buildActivePath,
  buildInactivePath,
  buildRenderPath,
  getNodeActiveHistoryMax,
  getNodeCategories,
  getRenderHistoryMax,
  isTimingActive
} from './profiler-chart-utils';

const active = (avg: number): TimingStats => ({
  avg,
  max: avg,
  p95: avg,
  last: avg,
  callsPerSecond: 2
});

const inactive = (avg: number): TimingStats => ({
  avg,
  max: avg,
  p95: avg,
  last: avg,
  callsPerSecond: 0
});

const snapshot = (timing?: TimingStats): ProfilerSnapshot => ({
  timestamp: 0,
  entries: [
    { nodeId: 'glsl-1', nodeType: 'glsl', timings: timing ? { draw: timing } : {}, isHot: false }
  ]
});

describe('profiler chart utils', () => {
  it('detects active timings from calls per second', () => {
    expect(isTimingActive(active(1))).toBe(true);
    expect(isTimingActive(inactive(1))).toBe(false);
  });

  it('collects node categories in profiler order', () => {
    const history: ProfilerSnapshot[] = [
      {
        timestamp: 0,
        entries: [
          {
            nodeId: 'glsl-1',
            nodeType: 'glsl',
            timings: { raf: active(1), draw: active(2) },
            isHot: false
          }
        ]
      }
    ];

    expect(getNodeCategories('glsl-1', history)).toEqual(['draw', 'raf']);
  });

  it('scales history by active timings only', () => {
    const history = [snapshot(active(3)), snapshot(inactive(10))];

    expect(getNodeActiveHistoryMax('glsl-1', history)).toBe(3);
  });

  it('splits active and inactive paths', () => {
    const history = [snapshot(active(2)), snapshot(inactive(2)), snapshot(active(4))];

    expect(buildActivePath('glsl-1', 'draw', history, 4)).toBe('M3.0 26.0M237.0 3.0');
    expect(buildInactivePath('glsl-1', 'draw', history, 4)).toBe('M120.0 49.0');
  });

  it('builds render frame paths and breaks on missing frame stats', () => {
    const history: ProfilerSnapshot[] = [
      {
        ...snapshot(),
        renderFrame: {
          fps: 60,
          avgMs: 2,
          p50Ms: 1,
          p95Ms: 3,
          p99Ms: 4,
          drops60: 0,
          gpuReadAvgMs: null,
          blitAvgMs: null,
          transferAvgMs: null,
          previewAvgMs: null,
          videoAvgMs: null
        }
      },
      snapshot(),
      {
        ...snapshot(),
        renderFrame: {
          fps: 30,
          avgMs: 4,
          p50Ms: 2,
          p95Ms: 5,
          p99Ms: 6,
          drops60: 1,
          gpuReadAvgMs: null,
          blitAvgMs: null,
          transferAvgMs: null,
          previewAvgMs: null,
          videoAvgMs: null
        }
      }
    ];

    const avgMetric = {
      get: (renderFrame: NonNullable<ProfilerSnapshot['renderFrame']>) => renderFrame.avgMs
    };

    expect(getRenderHistoryMax(history, [avgMetric])).toBe(4);
    expect(buildRenderPath(avgMetric, history, 4)).toBe('M3.0 26.0M237.0 3.0');
  });
});
