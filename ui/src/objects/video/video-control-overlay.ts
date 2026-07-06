export const VIDEO_OVERLAY_IDLE_MS = 1800;

export function formatVideoOverlayTime(timeSeconds: number): string {
  if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(timeSeconds);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  if (hours > 0) {
    return `${hours}:${padClockPart(minutes)}:${padClockPart(seconds)}`;
  }

  return `${padClockPart(minutes)}:${padClockPart(seconds)}`;
}

export function getVideoOverlayDisplayTime({
  workerTime,
  elementTime,
  hasWorkerFrame,
  pendingSeekTime
}: {
  workerTime: number;
  elementTime: number | undefined;
  hasWorkerFrame: boolean;
  pendingSeekTime?: number | null;
}): number {
  if (Number.isFinite(pendingSeekTime)) {
    return Math.max(0, pendingSeekTime ?? 0);
  }

  if (hasWorkerFrame && Number.isFinite(workerTime)) {
    return Math.max(0, workerTime);
  }

  return Number.isFinite(elementTime) ? Math.max(0, elementTime ?? 0) : 0;
}

export function getVideoOverlayDuration({
  metadataDuration,
  elementDuration
}: {
  metadataDuration: number | undefined;
  elementDuration: number | undefined;
}): number {
  if (Number.isFinite(metadataDuration)) {
    return Math.max(0, metadataDuration ?? 0);
  }

  if (Number.isFinite(elementDuration)) {
    return Math.max(0, elementDuration ?? 0);
  }

  return 0;
}

export function getRangePointerTime({
  clientX,
  left,
  width,
  min,
  max
}: {
  clientX: number;
  left: number;
  width: number;
  min: number;
  max: number;
}): number {
  if (!Number.isFinite(width) || width <= 0) {
    return min;
  }

  const progress = Math.min(1, Math.max(0, (clientX - left) / width));

  return min + (max - min) * progress;
}

export function isPendingSeekComplete({
  pendingSeekTime,
  currentTime,
  tolerance = 0.1
}: {
  pendingSeekTime: number | null;
  currentTime: number;
  tolerance?: number;
}): boolean {
  return (
    Number.isFinite(pendingSeekTime) &&
    Number.isFinite(currentTime) &&
    Math.abs(currentTime - (pendingSeekTime ?? 0)) <= tolerance
  );
}

export class VideoControlOverlayVisibility {
  visible = false;
  private scrubbing = false;
  private lastActivityTime = 0;

  show(now: number): void {
    this.visible = true;
    this.lastActivityTime = now;
  }

  hide(): void {
    if (this.scrubbing) return;

    this.visible = false;
  }

  startScrubbing(): void {
    this.visible = true;
    this.scrubbing = true;
  }

  stopScrubbing(now: number): void {
    this.scrubbing = false;
    this.show(now);
  }

  shouldHide(now: number): boolean {
    return this.visible && !this.scrubbing && now - this.lastActivityTime >= VIDEO_OVERLAY_IDLE_MS;
  }
}

export class VideoOverlaySeekPlaybackGate {
  private active = false;
  private resumeAfterSeek = false;

  start({ paused }: { paused: boolean }): { shouldPause: boolean } {
    if (this.active) {
      return { shouldPause: false };
    }

    this.active = true;
    this.resumeAfterSeek = !paused;

    return { shouldPause: this.resumeAfterSeek };
  }

  stop(): { shouldResume: boolean } {
    const shouldResume = this.resumeAfterSeek;

    this.active = false;
    this.resumeAfterSeek = false;

    return { shouldResume };
  }
}

export class VideoOverlayPointerFocusGate {
  private pointerSeekStarted = false;

  startPointerSeek(): void {
    this.pointerSeekStarted = true;
  }

  shouldStartSeekOnFocus(): boolean {
    return !this.pointerSeekStarted;
  }

  endPointerSeek(): void {
    this.pointerSeekStarted = false;
  }
}

function padClockPart(value: number): string {
  return value.toString().padStart(2, '0');
}
