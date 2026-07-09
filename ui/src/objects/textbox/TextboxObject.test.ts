import { describe, expect, it } from 'vitest';

import { TextboxObject } from '$objects/textbox/TextboxObject';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta } from '$lib/objects/v2/interfaces/text-objects';
import { resolveMessageInlet } from '$lib/objects/v2/resolve-message-inlet';

function createTextbox(initialText = '') {
  const sent: unknown[] = [];
  const values: Record<string, unknown> = {
    message: initialText
  };
  const updates: Array<{ name: string | number; value: unknown; options: unknown }> = [];

  const context = {
    send(data: unknown) {
      sent.push(data);
    },
    setParam(indexOrName: number | string, value: unknown, options?: unknown) {
      values[String(indexOrName)] = value;
      updates.push({ name: indexOrName, value, options });
    },
    getParam(indexOrName: number | string) {
      return values[String(indexOrName)];
    }
  } as ObjectContext;

  const object = new TextboxObject('textbox-1', context);

  return { object, sent, updates, values };
}

const meta = (inletName = 'message'): MessageMeta => ({ source: 'source', inletName });

describe('TextboxObject', () => {
  it('stores string messages as text and notifies the UI', () => {
    const { object, sent, updates, values } = createTextbox();

    object.onMessage('hello patch', meta());

    expect(values.message).toBe('hello patch');
    expect(updates).toEqual([
      { name: 'message', value: 'hello patch', options: { notifyUI: true } }
    ]);
    expect(sent).toEqual([]);
  });

  it('outputs the current text on bang', () => {
    const { object, sent, values } = createTextbox('stored text');

    object.onMessage({ type: 'bang' }, meta());

    expect(values.message).toBe('stored text');
    expect(sent).toEqual(['stored text']);
  });

  it('clears stored text on clear and notifies the UI', () => {
    const { object, sent, updates, values } = createTextbox('erase me');

    object.onMessage({ type: 'clear' }, meta());

    expect(values.message).toBe('');
    expect(updates).toEqual([{ name: 'message', value: '', options: { notifyUI: true } }]);
    expect(sent).toEqual([]);
  });

  it('handles UI-originated send messages without resolved inlet metadata', () => {
    const { object, sent } = createTextbox('from ui');

    object.onMessage({ type: 'bang' }, { source: 'textbox-1' });

    expect(sent).toEqual(['from ui']);
  });

  it('handles UI-originated text updates without resolved inlet metadata', () => {
    const { object, values } = createTextbox();

    object.onMessage('typed locally', { source: 'textbox-1' });

    expect(values.message).toBe('typed locally');
  });

  it('resolves edge messages sent through the legacy message-in handle', () => {
    const resolved = resolveMessageInlet(TextboxObject.inlets, {
      source: 'msg-7',
      inletKey: 'message-in',
      outletKey: 'message-out'
    });

    expect(resolved).toEqual({ inlet: 0, inletName: 'message' });
  });
});
