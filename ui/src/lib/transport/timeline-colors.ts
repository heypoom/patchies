const TIMELINE_PALETTE = [
  '#f97316', // orange-500
  '#3b82f6', // blue-500
  '#22c55e', // green-500
  '#eab308', // yellow-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#ef4444' // red-500
];

/** Deterministic color for a nodeId based on string hash. */
export function getNodeTimelineColor(nodeId: string): string {
  let hash = 0;

  for (let i = 0; i < nodeId.length; i++) {
    hash = ((hash << 5) - hash + nodeId.charCodeAt(i)) | 0;
  }

  return TIMELINE_PALETTE[Math.abs(hash) % TIMELINE_PALETTE.length];
}
