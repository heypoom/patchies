export interface SerialQueue {
  readonly current: Promise<void>;

  runSerialized(operation: () => Promise<void>): Promise<void>;
}

/**
 * Runs operations one at a time without letting a failed operation prevent
 * later work from running.
 */
export const createSerialQueue = (): SerialQueue => {
  let queue = Promise.resolve();

  return {
    get current(): Promise<void> {
      return queue;
    },

    runSerialized(operation): Promise<void> {
      const next = queue.catch(() => undefined).then(operation);
      queue = next;

      return next;
    }
  };
};
