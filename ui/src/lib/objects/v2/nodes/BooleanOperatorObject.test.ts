import { describe, expect, it } from 'vitest';

import {
  AndObject,
  EqualObject,
  GreaterThanObject,
  LessThanOrEqualObject,
  NotEqualObject,
  NotObject,
  OrObject
} from './BooleanOperatorObject';

import { validateMessageToObject } from '$lib/objects/validate-object-message';
import { Bang } from '$lib/objects/schemas/common';

import type { ObjectContext } from '../ObjectContext';
import type { MessageMeta, TextObjectV2 } from '../interfaces/text-objects';

interface SentMessage {
  data: unknown;
  options: unknown;
}

type BooleanOperatorClass = new (nodeId: string, context: ObjectContext) => TextObjectV2;

function createBooleanOperator(ObjectClass: BooleanOperatorClass, params: unknown[] = []) {
  const sent: SentMessage[] = [];
  const values: Record<string, unknown> = {
    operand: false
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

  const object = new ObjectClass('operator-1', context);
  object.create?.(params);

  return { object, sent, values };
}

const meta = (inletName: string): MessageMeta => ({ source: 'source', inletName });

describe('BooleanOperatorObject', () => {
  it('applies greater-than comparison against the stored right operand', () => {
    const { object, sent } = createBooleanOperator(GreaterThanObject, [0.5]);

    object.onMessage?.(0.75, meta('value'));
    object.onMessage?.(0.25, meta('value'));

    expect(sent).toEqual([
      { data: true, options: undefined },
      { data: false, options: undefined }
    ]);
  });

  it('updates binary operator operands from the cold inlet without outputting immediately', () => {
    const { object, sent, values } = createBooleanOperator(LessThanOrEqualObject, [10]);

    object.onMessage?.(4, meta('operand'));
    object.onMessage?.(5, meta('value'));

    expect(values.operand).toBe(4);
    expect(sent).toEqual([{ data: false, options: undefined }]);
  });

  it('accepts bang on the hot inlet and re-emits using the stored value', () => {
    const { object, sent } = createBooleanOperator(GreaterThanObject, [3]);

    object.onMessage?.(5, meta('value'));
    object.onMessage?.({ type: 'bang' }, meta('value'));

    expect(GreaterThanObject.inlets[0].messages?.some(({ schema }) => schema === Bang)).toBe(true);
    expect(validateMessageToObject({ type: 'bang' }, GreaterThanObject.inlets[0])).toBe(true);
    expect(sent).toEqual([
      { data: true, options: undefined },
      { data: true, options: undefined }
    ]);
  });

  it('uses strict equality for equality operators', () => {
    const equal = createBooleanOperator(EqualObject, [1]);
    const notEqual = createBooleanOperator(NotEqualObject, [1]);

    equal.object.onMessage?.('1', meta('value'));
    notEqual.object.onMessage?.('1', meta('value'));

    expect(equal.sent).toEqual([{ data: false, options: undefined }]);
    expect(notEqual.sent).toEqual([{ data: true, options: undefined }]);
  });

  it('treats zero as false and non-zero numbers as true', () => {
    const and = createBooleanOperator(AndObject, [true]);
    const or = createBooleanOperator(OrObject, [false]);

    and.object.onMessage?.(-1, meta('value'));
    and.object.onMessage?.(1, meta('value'));
    or.object.onMessage?.(0, meta('value'));
    or.object.onMessage?.(2, meta('value'));

    expect(and.sent).toEqual([
      { data: true, options: undefined },
      { data: true, options: undefined }
    ]);
    expect(or.sent).toEqual([
      { data: false, options: undefined },
      { data: true, options: undefined }
    ]);
  });

  it('inverts the truthiness of the hot input for not', () => {
    const { object, sent } = createBooleanOperator(NotObject);

    object.onMessage?.(0, meta('value'));
    object.onMessage?.(3, meta('value'));

    expect(sent).toEqual([
      { data: true, options: undefined },
      { data: false, options: undefined }
    ]);
  });

  it('accepts bang on unary hot inlets and re-emits using the stored value', () => {
    const { object, sent } = createBooleanOperator(NotObject);

    object.onMessage?.(0, meta('value'));
    object.onMessage?.({ type: 'bang' }, meta('value'));

    expect(NotObject.inlets[0].messages?.some(({ schema }) => schema === Bang)).toBe(true);
    expect(validateMessageToObject({ type: 'bang' }, NotObject.inlets[0])).toBe(true);
    expect(sent).toEqual([
      { data: true, options: undefined },
      { data: true, options: undefined }
    ]);
  });
});
