import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { match, P } from 'ts-pattern';

/**
 * IntObject stores and outputs an integer value.
 * Similar to Pure Data's [i] or [int] object.
 *
 * - Inlet 0 (hot): Set value and output immediately. Bang outputs current value.
 * - Inlet 1 (cold): Set value without outputting.
 */
export class IntObject implements TextObjectV2 {
  static type = 'i';
  static aliases = ['int'];
  static description = 'Integer accumulator (hot inlet sets and outputs, cold inlet sets only)';

  static inlets: ObjectInlet[] = [
    {
      name: 'hot',
      type: 'message',
      description: 'Set value and output (or bang to output current)',
      defaultValue: 0
    },
    {
      name: 'cold',
      type: 'int',
      description: 'Set value without output'
    }
  ];

  static outlets: ObjectOutlet[] = [{ name: 'out', type: 'int', description: 'Integer output' }];

  readonly nodeId: string;
  readonly context: ObjectContext;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  create(params: unknown[]): void {
    // Set initial value from first argument (e.g., "i 69" sets initial value to 69)
    if (params.length > 0 && params[0] !== undefined) {
      const num = Number(params[0]);
      if (!isNaN(num)) {
        this.context.setParam('hot', Math.floor(num));
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
        const value = Math.floor(num);
        this.context.setParam('hot', value);
        this.context.send(value);
      })
      // Cold inlet: number sets without output
      .with(['cold', P.number], ([, num]) => {
        const value = Math.floor(num);
        this.context.setParam('hot', value);
      });
  }
}
