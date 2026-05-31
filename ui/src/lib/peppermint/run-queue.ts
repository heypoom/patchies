export class PeppermintRunQueue<TInput = unknown> {
  private isRunning = false;
  private pendingInput: TInput | undefined;
  private pendingPromise: Promise<void> | null = null;
  private idleResolvers: Array<() => void> = [];

  constructor(private readonly run: (input: TInput) => Promise<void>) {}

  async requestRun(input: TInput): Promise<void> {
    if (this.isRunning) {
      this.pendingInput = input;
      return this.pendingPromise ?? Promise.resolve();
    }

    this.isRunning = true;
    this.pendingPromise = this.drain(input);

    try {
      await this.pendingPromise;
    } finally {
      this.pendingPromise = null;
      this.resolveIdle();
    }
  }

  async whenIdle(): Promise<void> {
    if (!this.isRunning && this.pendingPromise === null) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  private async drain(input: TInput): Promise<void> {
    let nextInput: TInput | undefined = input;

    try {
      while (nextInput !== undefined) {
        const currentInput = nextInput;
        nextInput = undefined;

        await this.run(currentInput);

        if (this.pendingInput !== undefined) {
          nextInput = this.pendingInput;
          this.pendingInput = undefined;
        }
      }
    } finally {
      this.pendingInput = undefined;
      this.isRunning = false;
    }
  }

  private resolveIdle() {
    const resolvers = this.idleResolvers;
    this.idleResolvers = [];

    for (const resolve of resolvers) {
      resolve();
    }
  }
}
