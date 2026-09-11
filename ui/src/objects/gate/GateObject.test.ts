import { describe, expect, it } from 'vitest';

import { GateObject } from '$objects/gate/GateObject';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta } from '$lib/objects/v2/interfaces/text-objects';

const meta = (inlet: number): MessageMeta => ({ source: 'source', inlet });

function createGate(params: unknown[] = []) {
  const sent: Array<{ data: unknown; options: unknown }> = [];
  const context = {
    send(data: unknown, options?: unknown) {
      sent.push({ data, options });
    }
  } as ObjectContext;
  const object = new GateObject('gate-1', context);

  object.create(params);

  return { object, sent };
}

describe('GateObject', () => {
  it('marks its data inlet hot and selector inlet cold', () => {
    expect(GateObject.inlets).toMatchObject([
      { name: 'select', hot: false },
      { name: 'input', hot: true }
    ]);
  });

  it('routes data to the selected default outlet', () => {
    const { object, sent } = createGate();

    object.onMessage?.(2, meta(0));
    object.onMessage?.('second outlet', meta(1));

    expect(sent).toEqual([{ data: 'second outlet', options: { to: 1 } }]);
  });

  it('uses its argument to create outlets', () => {
    const { object, sent } = createGate([3]);

    object.onMessage?.(3, meta(0));
    object.onMessage?.('third outlet', meta(1));

    expect(object.getOutlets().map((outlet) => outlet.name)).toEqual(['1', '2', '3']);
    expect(sent).toEqual([{ data: 'third outlet', options: { to: 2 } }]);
  });

  it('closes for zero and out-of-range selectors', () => {
    const { object, sent } = createGate();

    object.onMessage?.(0, meta(0));
    object.onMessage?.('closed', meta(1));
    object.onMessage?.(3, meta(0));
    object.onMessage?.('out of range', meta(1));

    expect(sent).toEqual([]);
  });
});
