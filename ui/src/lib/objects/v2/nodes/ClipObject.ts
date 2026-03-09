import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { P, match } from 'ts-pattern';
import { Type } from '@sinclair/typebox';

/**
 * ClipObject clamps a number to the range [min, max].
 * Similar to Pure Data's [clip] object.
 *
 * Usage: `clip min max`
 */
export class ClipObject implements TextObjectV2 {
  static type = 'clip';
  static description = 'Clamp a number to a min/max range';
  static tags = ['math', 'clamp', 'limit', 'range', 'control'];

  static inlets: ObjectInlet[] = [
    {
      name: 'value',
      type: 'message',
      description: 'Value to clip',
      hot: true,
      hideTextParam: true,
      messages: [{ schema: Type.Number(), description: 'Clip this number to the min/max range' }]
    },
    {
      name: 'min',
      type: 'float',
      description: 'Minimum value (lower bound)',
      defaultValue: 0
    },
    {
      name: 'max',
      type: 'float',
      description: 'Maximum value (upper bound)',
      defaultValue: 1
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'float', description: 'Clipped value output' }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  create(params: unknown[]): void {
    console.log('clip!', params);

    // `clip min max` — first arg is min, second is max
    if (params[0] !== undefined) {
      const min = Number(params[0]);

      if (!isNaN(min)) {
        this.context.setParam('min', min);
      }
    }

    if (params[1] !== undefined) {
      const max = Number(params[1]);

      if (!isNaN(max)) {
        this.context.setParam('max', max);
      }
    }
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    match([meta.inletName, data])
      .with(['value', P.number], ([, value]) => {
        if (isNaN(value)) return;

        const min = (this.context.getParam('min') as number) ?? 0;
        const max = (this.context.getParam('max') as number) ?? 1;

        this.context.send(Math.max(min, Math.min(max, value)));
      })
      .with(['min', P.number], ([, value]) => {
        this.context.setParam('min', value);
      })
      .with(['max', P.number], ([, value]) => {
        this.context.setParam('max', value);
      })
      .otherwise(() => {});
  }
}
