import { Type } from '@sinclair/typebox';
import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { Bang } from '$lib/objects/schemas/common';

export class ButtonObject implements TextObjectV2 {
  static type = 'button';
  static category = 'interface';
  static description = 'Button that sends bang when clicked or messaged';
  static tags = ['interface', 'control', 'trigger', 'input'];

  static inlets: ObjectInlet[] = [
    {
      name: 'message',
      type: 'any',
      description: 'Control messages',
      messages: [{ schema: Type.Any(), description: 'Flash button and output bang' }],
      handle: { handleType: 'message' }
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'message',
      type: 'bang',
      description: 'Button output',
      messages: [
        { schema: Bang, description: 'Sent when button is clicked or receives any message' }
      ],
      handle: { handleType: 'message' }
    }
  ];

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {}

  onMessage(): void {
    this.context.send({ type: 'bang' });
  }
}
