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

  // Frame drops below 60fps threshold
  drops60: number;

  // Per-operation breakdown (average ms per frame, null if no samples)
  gpuReadAvgMs: number | null;
  blitAvgMs: number | null;
  transferAvgMs: number | null;
  previewAvgMs: number | null;
  videoAvgMs: number | null;
}

export type RenderOp = 'blit' | 'transfer' | 'preview' | 'video';

export interface ProfilerSnapshot {
  timestamp: number;
  entries: NodeProfileEntry[];
  renderFrame?: RenderFrameStats;
}

export const HOT_THRESHOLD_MS = 2;
