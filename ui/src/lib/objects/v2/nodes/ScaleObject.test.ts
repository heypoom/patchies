import { describe, expect, it } from 'vitest';

import { ScaleObject } from './ScaleObject';

import type { ObjectContext } from '../ObjectContext';
import type { MessageMeta } from '../interfaces/text-objects';

interface SentMessage {
  data: unknown;
  options: unknown;
}

function createScaleObject(params: unknown[] = []) {
  const sent: SentMessage[] = [];

  const values: Record<string, unknown> = {
    inMin: 0,
    inMax: 1,
    outMin: 0,
    outMax: 1
  };

  const context = {
    send(data: unknown, options?: unknown) {
      sent.push({ data, options });
    },
    setParam(indexOrName: number | string, value: unknown) {
      values[String(indexOrName)] = value;
    },
    getParam(indexOrName: number | string) {
      return values[String(indexOrName)];
    }
  } as ObjectContext;

  const object = new ScaleObject('scale-1', context);
  object.create(params);

  return { object, sent, values };
}

const meta = (inletName: string): MessageMeta => ({ source: 'source', inletName });

describe('ScaleObject', () => {
  it('remaps numbers from the source range to the target range', () => {
    const { object, sent } = createScaleObject([0, 127, 0, 1]);

    object.onMessage(64, meta('value'));

    expect(sent).toEqual([{ data: 64 / 127, options: undefined }]);
  });

  it('extrapolates outside the source range', () => {
    const { object, sent } = createScaleObject([0, 10, 0, 100]);

    object.onMessage(11, meta('value'));

    expect(sent).toHaveLength(1);
    expect(sent[0].data).toBeCloseTo(110);
  });

  it('updates cold range params without output', () => {
    const { object, sent, values } = createScaleObject([0, 1, 0, 10]);

    object.onMessage(20, meta('outMax'));
    object.onMessage(0.5, meta('value'));

    expect(values.outMax).toBe(20);
    expect(sent).toEqual([{ data: 10, options: undefined }]);
  });

  it('does not emit when the source range has zero length', () => {
    const { object, sent } = createScaleObject([1, 1, 0, 100]);

    object.onMessage(1, meta('value'));

    expect(sent).toEqual([]);
  });
});
