export interface TimingStats {
  avg: number; // milliseconds
  max: number;
  p95: number;
  last: number;
  callsPerSecond: number;
}

export type ProfilerCategory = 'init' | 'message' | 'draw' | 'interval' | 'raf';

export interface NodeProfileEntry {
  nodeId: string;
  nodeType: string;

  /** Timing per category — only categories with recorded data are present */
  timings: Partial<Record<ProfilerCategory, TimingStats>>;

  isHot: boolean;
}

export interface RenderFrameStats {
  fps: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  drops60: number;
  gpuReadAvgMs: number | null;
}

export interface ProfilerSnapshot {
  timestamp: number;
  entries: NodeProfileEntry[];
  renderFrame?: RenderFrameStats;
}

export const HOT_THRESHOLD_MS = 2;
