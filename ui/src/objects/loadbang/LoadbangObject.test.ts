import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoadbangObject } from '$objects/loadbang/LoadbangObject';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';

function createLoadbang() {
  const sent: unknown[] = [];

  const context = {
    send(data: unknown) {
      sent.push(data);
    }
  } as ObjectContext;

  const object = new LoadbangObject('loadbang-1', context);

  return { object, sent };
}

describe('LoadbangObject', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a bang after connections have time to initialize', () => {
    vi.useFakeTimers();

    const { object, sent } = createLoadbang();

    object.create();

    vi.advanceTimersByTime(499);
    expect(sent).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(sent).toEqual([{ type: 'bang' }]);
  });
});
