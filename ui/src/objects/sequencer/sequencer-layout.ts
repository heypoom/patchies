/**
 * Returns the node height after adding or removing sequencer tracks while
 * preserving the current per-track cell size.
 */
export function getHeightForTrackCountChange(
  currentNodeHeight: number,
  previousTrackCount: number,
  nextTrackCount: number,
  gridHeight: number,
  scale: number
): number {
  const trackCountDelta = nextTrackCount - previousTrackCount;
  const trackHeight = 4 + gridHeight;

  return currentNodeHeight + trackCountDelta * trackHeight * scale;
}
