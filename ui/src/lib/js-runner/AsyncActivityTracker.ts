/** Tracks finite async work independently from persistent callbacks. */
export class AsyncActivityTracker {
  private pending = 0;
  private generation = 0;

  constructor(private onChange: (active: boolean) => void) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const generation = this.generation;

    if (this.pending++ === 0) {
      this.onChange(true);
    }

    try {
      return await operation();
    } finally {
      if (generation === this.generation && --this.pending === 0) {
        this.onChange(false);
      }
    }
  }

  reset(): void {
    this.generation++;

    if (this.pending > 0) {
      this.pending = 0;
      this.onChange(false);
    }
  }
}
