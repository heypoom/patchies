export interface TimingStats {
  avg: number; // milliseconds
  max: number;
  p95: number;
  last: number;
  callsPerSecond: number;
}

export interface NodeProfileEntry {
  nodeId: string;
  nodeType: string;
  processingTime: TimingStats;
  isHot: boolean;
}

export interface ProfilerSnapshot {
  timestamp: number;
  entries: NodeProfileEntry[];
}

export const HOT_THRESHOLD_MS = 2;
