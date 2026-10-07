import { expect, test, vi } from 'vitest';

import { AsyncActivityTracker } from './AsyncActivityTracker';

const deferred = () => {
  let resolve!: () => void;

  const promise = new Promise<void>((done) => {
    resolve = done;
  });

  return { promise, resolve };
};

test('keeps activity until overlapping operations settle, including failures', async () => {
  const changed = vi.fn();
  const activity = new AsyncActivityTracker(changed);
  const first = deferred();
  const second = deferred();

  const a = activity.run(() => first.promise);

  const b = activity.run(async () => {
    await second.promise;

    throw new Error('failed');
  });

  const failed = expect(b).rejects.toThrow('failed');

  expect(changed.mock.calls).toEqual([[true]]);

  first.resolve();
  await a;

  expect(changed.mock.calls).toEqual([[true]]);

  second.resolve();
  await failed;

  expect(changed.mock.calls).toEqual([[true], [false]]);
});

test('reset ignores an old completion while a new run is pending', async () => {
  const changed = vi.fn();
  const activity = new AsyncActivityTracker(changed);
  const old = deferred();
  const current = deferred();

  const a = activity.run(() => old.promise);

  activity.reset();

  const b = activity.run(() => current.promise);

  old.resolve();
  await a;

  expect(changed.mock.calls).toEqual([[true], [false], [true]]);

  current.resolve();
  await b;

  expect(changed.mock.calls).toEqual([[true], [false], [true], [false]]);
});
