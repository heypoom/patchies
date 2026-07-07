import { afterEach, describe, expect, it, vi } from 'vitest';

import { MetroObject } from '$objects/metro/MetroObject';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta } from '$lib/objects/v2/interfaces/text-objects';

function createMetro() {
  const sent: unknown[] = [];
  const values: Record<string, unknown> = {
    interval: 10
  };

  const context = {
    send(data: unknown) {
      sent.push(data);
    },
    setParam(indexOrName: number | string, value: unknown) {
      values[String(indexOrName)] = value;
    },
    getParam(indexOrName: number | string) {
      return values[String(indexOrName)];
    }
  } as ObjectContext;

  const object = new MetroObject('metro-1', context);

  return { object, sent };
}

const meta = (inletName: string): MessageMeta => ({ source: 'source', inletName });

describe('MetroObject', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses boolean messages to start and stop the metronome', () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);

    const { object, sent } = createMetro();

    object.create();
    vi.advanceTimersByTime(10);
    expect(sent).toEqual([{ type: 'bang' }]);

    object.onMessage?.(false, meta('message'));
    vi.advanceTimersByTime(30);
    expect(sent).toEqual([{ type: 'bang' }]);

    object.onMessage?.(true, meta('message'));
    vi.advanceTimersByTime(10);
    expect(sent).toEqual([{ type: 'bang' }, { type: 'bang' }]);

    object.destroy();
  });
});
