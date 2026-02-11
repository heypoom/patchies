import { Type } from '@sinclair/typebox';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';

/**
 * MtofObject converts MIDI note numbers to frequency values.
 * Formula: frequency = 440 * 2^((note - 69) / 12)
 */
export class MtofObject implements TextObjectV2 {
  static type = 'mtof';
  static description = 'Converts MIDI note values to frequency float values';
  static tags = ['control', 'midi', 'frequency', 'conversion'];

  static inlets: ObjectInlet[] = [
    {
      name: 'note',
      type: 'float',
      description: 'MIDI note input',
      messages: [
        {
          schema: Type.Number({ minimum: 0, maximum: 127 }),
          description: 'MIDI note value (0-127)'
        }
      ],
      hot: true
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'frequency', type: 'float', description: 'Frequency output in Hz' }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    if (meta.inletName === 'note' && typeof data === 'number') {
      const frequency = 440 * Math.pow(2, (data - 69) / 12);
      this.context.send(frequency);
    }
  }
}
