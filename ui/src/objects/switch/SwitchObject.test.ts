import { describe, expect, it } from 'vitest';

import { SwitchObject } from '$objects/switch/SwitchObject';
import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta } from '$lib/objects/v2/interfaces/text-objects';

const meta = (inlet: number): MessageMeta => ({
  source: 'source',
  inlet
});

function createSwitch(params: unknown[] = []) {
  const sent: { data: unknown; options: unknown }[] = [];

  const context = {
    send(data: unknown, options?: unknown) {
      sent.push({ data, options });
    }
  } as ObjectContext;

  const object = new SwitchObject('switch-1', context);
  object.create(params);

  return { object, sent };
}

describe('SwitchObject', () => {
  it('marks its data inlets hot and selector inlet cold', () => {
    expect(SwitchObject.inlets).toMatchObject([
      { name: '1', hot: true },
      { name: '2', hot: true },
      { name: 'select', hot: false }
    ]);

    expect(createSwitch([3]).object.getInlets()).toMatchObject([
      { name: '1', hot: true },
      { name: '2', hot: true },
      { name: '3', hot: true },
      { name: 'select', hot: false }
    ]);
  });

  it('routes the selected default input to its outlet', () => {
    const { object, sent } = createSwitch();
    object.onMessage?.(2, meta(2));
    object.onMessage?.('first', meta(0));
    object.onMessage?.('second', meta(1));

    expect(sent).toEqual([{ data: 'second', options: undefined }]);
  });

  it('uses its argument to create data inlets', () => {
    const { object, sent } = createSwitch([3]);
    object.onMessage?.(3, meta(3));
    object.onMessage?.('third', meta(2));

    expect(object.getInlets().map((inlet) => inlet.name)).toEqual(['1', '2', '3', 'select']);
    expect(sent).toEqual([{ data: 'third', options: undefined }]);
  });

  it('closes for zero and out-of-range selectors', () => {
    const { object, sent } = createSwitch();
    object.onMessage?.(0, meta(2));
    object.onMessage?.('closed', meta(0));
    object.onMessage?.(3, meta(2));
    object.onMessage?.('out of range', meta(1));

    expect(sent).toEqual([]);
  });
});
