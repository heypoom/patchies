type ScheduleFrame = (callback: FrameRequestCallback) => number;
type CancelFrame = (frameId: number) => void;

const scheduleAnimationFrame: ScheduleFrame = (callback) => requestAnimationFrame(callback);
const cancelScheduledAnimationFrame: CancelFrame = (frameId) => cancelAnimationFrame(frameId);

export class FloatTextureFrameUploadScheduler<T> {
  private frameId: number | null = null;
  private latestUpload: T | undefined;
  private hasUpload = false;

  constructor(
    private flush: (upload: T) => void,
    private scheduleFrame: ScheduleFrame = scheduleAnimationFrame,
    private cancelFrame: CancelFrame = cancelScheduledAnimationFrame
  ) {}

  queue(upload: T): void {
    this.latestUpload = upload;
    this.hasUpload = true;

    if (this.frameId !== null) return;

    this.frameId = this.scheduleFrame(() => {
      this.frameId = null;

      if (!this.hasUpload) return;

      const latestUpload = this.latestUpload as T;

      this.latestUpload = undefined;
      this.hasUpload = false;

      this.flush(latestUpload);
    });
  }

  cancel(): void {
    if (this.frameId !== null) {
      this.cancelFrame(this.frameId);
      this.frameId = null;
    }

    this.latestUpload = undefined;
    this.hasUpload = false;
  }
}
