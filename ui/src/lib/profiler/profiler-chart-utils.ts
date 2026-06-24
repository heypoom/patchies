import type { ProfilerCategory, ProfilerSnapshot, RenderFrameStats, TimingStats } from './types';

export const PROFILER_CHART_WIDTH = 240;
export const PROFILER_CHART_HEIGHT = 52;
export const PROFILER_CHART_PADDING = 3;

const ORDERED_CATEGORIES: ProfilerCategory[] = ['init', 'message', 'draw', 'interval', 'raf'];

export const isTimingActive = (t: TimingStats): boolean => t.callsPerSecond > 0;

export function getNodeCategories(nodeId: string, history: ProfilerSnapshot[]): ProfilerCategory[] {
  const seen = new Set<ProfilerCategory>();

  for (const snapshot of history) {
    const entry = snapshot.entries.find((e) => e.nodeId === nodeId);
    if (!entry) continue;

    for (const cat of ORDERED_CATEGORIES) {
      if (entry.timings[cat]) seen.add(cat);
    }
  }

  return ORDERED_CATEGORIES.filter((cat) => seen.has(cat));
}

export function getNodeActiveHistoryMax(nodeId: string, history: ProfilerSnapshot[]): number {
  let max = 0.01;

  for (const snap of history) {
    const entry = snap.entries.find((e) => e.nodeId === nodeId);
    if (!entry) continue;

    for (const t of Object.values(entry.timings)) {
      if (t && isTimingActive(t) && t.avg > max) {
        max = t.avg;
      }
    }
  }

  return max;
}

export const getChartY = (value: number, maxValue: number): number =>
  PROFILER_CHART_HEIGHT -
  PROFILER_CHART_PADDING -
  (value / maxValue) * (PROFILER_CHART_HEIGHT - PROFILER_CHART_PADDING * 2);

export const buildActivePath = (
  nodeId: string,
  category: ProfilerCategory,
  history: ProfilerSnapshot[],
  maxValue: number
): string =>
  buildTimelinePath(history, maxValue, (snapshot) =>
    getNodeTiming(snapshot, nodeId, category, (timing) =>
      timing && isTimingActive(timing) ? timing.avg : null
    )
  );

export const buildInactivePath = (
  nodeId: string,
  category: ProfilerCategory,
  history: ProfilerSnapshot[],
  maxValue: number
): string =>
  buildTimelinePath(history, maxValue, (snapshot) =>
    getNodeTiming(snapshot, nodeId, category, (timing) =>
      timing && !isTimingActive(timing) ? 0 : null
    )
  );

export type RenderMetricGetter = {
  get: (renderFrame: RenderFrameStats) => number;
};

export const buildRenderPath = (
  metric: RenderMetricGetter,
  history: ProfilerSnapshot[],
  maxValue: number
): string =>
  buildTimelinePath(history, maxValue, (snapshot) =>
    snapshot.renderFrame ? metric.get(snapshot.renderFrame) : null
  );

export function getRenderHistoryMax(
  history: ProfilerSnapshot[],
  metrics: RenderMetricGetter[]
): number {
  let max = 0.01;

  for (const snap of history) {
    if (!snap.renderFrame) continue;

    for (const metric of metrics) {
      const value = metric.get(snap.renderFrame);
      if (value > max) max = value;
    }
  }

  return max;
}

const getNodeTiming = (
  snap: ProfilerSnapshot,
  nodeId: string,
  category: ProfilerCategory,
  getValue: (timing: TimingStats | undefined) => number | null
): number | null =>
  getValue(snap.entries.find((entry) => entry.nodeId === nodeId)?.timings[category]);

function buildTimelinePath(
  history: ProfilerSnapshot[],
  maxValue: number,
  getValue: (snap: ProfilerSnapshot) => number | null
): string {
  const len = history.length;
  if (len === 0) return '';

  let path = '';
  let penDown = false;

  for (let i = 0; i < len; i++) {
    const value = getValue(history[i]);

    if (value === null) {
      penDown = false;
      continue;
    }

    const x =
      len > 1
        ? (i / (len - 1)) * (PROFILER_CHART_WIDTH - PROFILER_CHART_PADDING * 2) +
          PROFILER_CHART_PADDING
        : PROFILER_CHART_WIDTH / 2;

    const y = getChartY(value, maxValue);

    path += penDown ? `L${x.toFixed(1)} ${y.toFixed(1)}` : `M${x.toFixed(1)} ${y.toFixed(1)}`;
    penDown = true;
  }

  return path;
}
