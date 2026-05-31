import { describe, expect, it } from 'vitest';
import { PeppermintRunQueue } from './run-queue';

describe('PeppermintRunQueue', () => {
  it('runs immediately with the requested input', async () => {
    const seen: unknown[] = [];
    const queue = new PeppermintRunQueue(async (input) => {
      seen.push(input);
    });

    await queue.requestRun('alice');

    expect(seen).toEqual(['alice']);
  });

  it('keeps only the latest pending input while a run is active', async () => {
    const seen: unknown[] = [];
    let releaseFirstRun!: () => void;
    const firstRun = new Promise<void>((resolve) => {
      releaseFirstRun = resolve;
    });

    const queue = new PeppermintRunQueue(async (input) => {
      seen.push(input);
      if (input === 'first') {
        await firstRun;
      }
    });

    const running = queue.requestRun('first');
    queue.requestRun('second');
    queue.requestRun('third');

    expect(seen).toEqual(['first']);

    releaseFirstRun();
    await running;
    await queue.whenIdle();

    expect(seen).toEqual(['first', 'third']);
  });

  it('returns to idle when a run fails', async () => {
    const seen: unknown[] = [];
    const queue = new PeppermintRunQueue(async (input) => {
      seen.push(input);
      if (input === 'bad') {
        throw new Error('boom');
      }
    });

    await expect(queue.requestRun('bad')).rejects.toThrow('boom');
    await queue.requestRun('good');

    expect(seen).toEqual(['bad', 'good']);
  });
});
