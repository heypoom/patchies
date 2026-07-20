export class RenderWorkerLifecycle {
  private startRequested = false;
  private running = false;

  get isRunning(): boolean {
    return this.running;
  }

  requestStart(): void {
    this.startRequested = true;
  }

  stop(): void {
    this.startRequested = false;
    this.running = false;
  }

  takeStart(hasRenderGraph: boolean): boolean {
    if (!this.startRequested || this.running || !hasRenderGraph) return false;

    this.running = true;

    return true;
  }
}
