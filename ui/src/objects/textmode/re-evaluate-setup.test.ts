import { describe, expect, it, vi } from 'vitest';
import { evaluateTextmodeCode } from './re-evaluate-setup';

function createDeferred() {
  let resolve: () => void;

  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve: resolve! };
}

describe('evaluateTextmodeCode', () => {
  it('replays the setup callback registered during a re-evaluation', async () => {
    const setup = vi.fn();
    const setupCallback = vi.fn();
    const tm = { setup };

    await evaluateTextmodeCode(
      tm as never,
      async () => {
        await tm.setup(setupCallback);
      },
      true
    );

    expect(setup).toHaveBeenCalledWith(setupCallback);
    expect(setupCallback).toHaveBeenCalledTimes(1);
  });

  it('leaves initial setup to the Textmodifier lifecycle', async () => {
    const setup = vi.fn();
    const setupCallback = vi.fn();
    const tm = { setup };

    await evaluateTextmodeCode(
      tm as never,
      async () => {
        await tm.setup(setupCallback);
      },
      false
    );

    expect(setupCallback).not.toHaveBeenCalled();
  });

  it('serializes overlapping evaluations for the same Textmodifier', async () => {
    const originalSetup = vi.fn();
    const firstSetupCallback = vi.fn();
    const secondSetupCallback = vi.fn();

    const firstExecution = createDeferred();
    const firstStarted = createDeferred();

    const tm = { setup: originalSetup };

    const firstEvaluation = evaluateTextmodeCode(
      tm as never,
      async () => {
        await tm.setup(firstSetupCallback);
        firstStarted.resolve();
        await firstExecution.promise;
      },
      true
    );

    await firstStarted.promise;

    const secondEvaluation = evaluateTextmodeCode(
      tm as never,
      async () => {
        await tm.setup(secondSetupCallback);
      },
      true
    );

    expect(originalSetup).toHaveBeenCalledTimes(1);

    firstExecution.resolve();
    await Promise.all([firstEvaluation, secondEvaluation]);

    expect(originalSetup).toHaveBeenNthCalledWith(1, firstSetupCallback);
    expect(originalSetup).toHaveBeenNthCalledWith(2, secondSetupCallback);
    expect(firstSetupCallback).toHaveBeenCalledTimes(1);
    expect(secondSetupCallback).toHaveBeenCalledTimes(1);
    expect(tm.setup).toBe(originalSetup);
  });
});
