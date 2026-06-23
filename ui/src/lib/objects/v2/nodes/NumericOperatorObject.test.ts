import { describe, expect, it } from 'vitest';

import { AddObject, DivideObject, MultiplyObject, SubtractObject } from './NumericOperatorObject';

import type { ObjectContext } from '../ObjectContext';
import type { MessageMeta, TextObjectV2 } from '../interfaces/text-objects';

interface SentMessage {
  data: unknown;
  options: unknown;
}

type NumericOperatorClass = new (nodeId: string, context: ObjectContext) => TextObjectV2;

function createNumericOperator(ObjectClass: NumericOperatorClass, params: unknown[] = []) {
  const sent: SentMessage[] = [];
  const values: Record<string, unknown> = {
    operand: 0
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

describe('NumericOperatorObject', () => {
  it.each([
    [AddObject, 2, 5, 7],
    [SubtractObject, 2, 5, 3],
    [MultiplyObject, 2, 5, 10],
    [DivideObject, 2, 5, 2.5]
  ])(
    'applies the creation argument as the right operand',
    (ObjectClass, operand, value, result) => {
      const { object, sent } = createNumericOperator(ObjectClass, [operand]);

      object.onMessage?.(value, meta('value'));

      expect(sent).toEqual([{ data: result, options: undefined }]);
    }
  );

  it('updates the operand from the cold inlet without outputting immediately', () => {
    const { object, sent, values } = createNumericOperator(MultiplyObject, [2]);

    object.onMessage?.(3, meta('operand'));
    object.onMessage?.(5, meta('value'));

    expect(values.operand).toBe(3);
    expect(sent).toEqual([{ data: 15, options: undefined }]);
  });

  it('outputs zero when dividing by zero', () => {
    const { object, sent } = createNumericOperator(DivideObject, [0]);

    object.onMessage?.(5, meta('value'));

    expect(sent).toEqual([{ data: 0, options: undefined }]);
  });
});
