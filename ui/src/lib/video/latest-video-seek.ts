export class LatestVideoSeek {
  private generation = 0;
  private targetTime = 0;
  private inFlight = false;

  request(time: number): number {
    this.generation += 1;
    this.targetTime = time;

    return this.generation;
  }

  requestNativeSeek(time: number): { generation: number; shouldStartSeek: boolean } {
    const generation = this.request(time);
    const shouldStartSeek = !this.inFlight;

    if (shouldStartSeek) {
      this.inFlight = true;
    }

    return { generation, shouldStartSeek };
  }

  completeNativeSeek(currentTime: number): { shouldStartNextSeek: boolean; targetTime: number } {
    this.inFlight = false;

    if (Math.abs(currentTime - this.targetTime) <= 0.001) {
      return { shouldStartNextSeek: false, targetTime: this.targetTime };
    }

    this.inFlight = true;

    return { shouldStartNextSeek: true, targetTime: this.targetTime };
  }

  isLatest(generation: number): boolean {
    return generation === this.generation;
  }

  get currentGeneration(): number {
    return this.generation;
  }

  get currentTargetTime(): number {
    return this.targetTime;
  }

  get isNativeSeekInFlight(): boolean {
    return this.inFlight;
  }
}
