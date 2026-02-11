import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { match, P } from 'ts-pattern';

/**
 * FloatObject stores and outputs a float value.
 * Similar to Pure Data's [f] or [float] object.
 *
 * - Inlet 0 (hot): Set value and output immediately. Bang outputs current value.
 * - Inlet 1 (cold): Set value without outputting.
 */
export class FloatObject implements TextObjectV2 {
  static type = 'f';
  static aliases = ['float'];
  static description = 'Float accumulator (hot inlet sets and outputs, cold inlet sets only)';

  static inlets: ObjectInlet[] = [
    {
      name: 'hot',
      type: 'message',
      description: 'Set value and output (or bang to output current)',
      defaultValue: 0,
      maxPrecision: 4,
      hot: true
    },
    {
      name: 'cold',
      type: 'float',
      description: 'Set value without output',
      maxPrecision: 4
    }
  ];

  static outlets: ObjectOutlet[] = [{ name: 'out', type: 'float', description: 'Float output' }];

  readonly nodeId: string;
  readonly context: ObjectContext;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  create(params: unknown[]): void {
    // Set initial value from first argument (e.g., "f 3.14" sets initial value to 3.14)
    if (params.length > 0 && params[0] !== undefined) {
      const num = Number(params[0]);
      if (!isNaN(num)) {
        this.context.setParam('hot', num);
      }
    }
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    match([meta.inletName, data])
      // Hot inlet: bang outputs current value
      .with(['hot', { type: 'bang' }], () => {
        const value = this.context.getParam('hot') as number;
        this.context.send(value);
      })
      // Hot inlet: number sets and outputs
      .with(['hot', P.number], ([, num]) => {
        this.context.setParam('hot', num);
        this.context.send(num);
      })
      // Cold inlet: number sets without output
      .with(['cold', P.number], ([, num]) => {
        this.context.setParam('hot', num);
      });
  }
}
