import { describe, expect, it } from 'vitest';

import { RecvObject } from '$objects/send-recv/RecvObject';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';

function createRecv(channel: string) {
  const values: Array<string | null> = [channel];
  const setParamOptions: unknown[] = [];

  const context = {
    getParam(indexOrName: number | string) {
      return indexOrName === 'channel' || indexOrName === 0 ? values[0] : undefined;
    },
    setParam(indexOrName: number | string, value: unknown, options?: unknown) {
      if (indexOrName === 'channel' || indexOrName === 0) {
        values[0] = String(value);
        setParamOptions[0] = options;
      }
    },
    onParamsChange() {
      return () => {};
    },
    send() {}
  } as unknown as ObjectContext;

  const object = new RecvObject(`recv-${crypto.randomUUID()}`, context);

  return { object, setParamOptions };
}

describe('RecvObject', () => {
  it('updates the channel label when receiving a channel message', () => {
    const { object, setParamOptions } = createRecv(`recv-channel-${crypto.randomUUID()}`);

    object.onMessage('new-channel', {
      inletName: 'channel',
      source: ''
    });

    expect(object.context.getParam('channel')).toBe('new-channel');
    expect(setParamOptions[0]).toEqual({ notifyUI: true });
  });
});
