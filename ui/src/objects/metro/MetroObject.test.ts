import { afterEach, describe, expect, it, vi } from 'vitest';

import { MetroObject } from '$objects/metro/MetroObject';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta } from '$lib/objects/v2/interfaces/text-objects';

function createMetro(onSend: () => void = () => {}) {
  const sent: unknown[] = [];
  const values: Record<string, unknown> = {
    interval: 10
  };

  const context = {
    send(data: unknown) {
      sent.push(data);
      onSend();
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
    vi.restoreAllMocks();
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

  it('does not reschedule after synchronous message handling stops it', () => {
    const timers: Array<() => void> = [];
    const clearTimeout = vi.fn();

    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('window', {
      setTimeout(callback: () => void) {
        timers.push(callback);

        return timers.length;
      },
      clearTimeout
    });

    let handleSend = () => {};
    const metro = createMetro(() => handleSend());
    const object = metro.object;

    handleSend = () => object.onMessage?.(false, meta('message'));

    object.create();
    timers[0]();

    expect(metro.sent).toEqual([{ type: 'bang' }]);
    expect(timers).toHaveLength(1);
    expect(clearTimeout).toHaveBeenCalledWith(1);

    object.destroy();
  });

  it('keeps its original phase after a late timer callback', () => {
    let now = 0;
    const timers: Array<{ callback: () => void; delay: number }> = [];

    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('window', {
      setTimeout(callback: () => void, delay: number) {
        timers.push({ callback, delay });

        return timers.length;
      },
      clearTimeout: vi.fn()
    });

    const { object, sent } = createMetro();

    object.create();
    expect(timers[0].delay).toBe(10);

    now = 35;
    timers[0].callback();

    expect(sent).toEqual([{ type: 'bang' }]);
    expect(timers[1].delay).toBe(5);

    now = 40;
    timers[1].callback();

    expect(sent).toEqual([{ type: 'bang' }, { type: 'bang' }]);
    expect(timers[2].delay).toBe(10);

    object.destroy();
  });
});
