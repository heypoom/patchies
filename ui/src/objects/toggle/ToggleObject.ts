import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta, TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { Bang, messages } from '$lib/objects/schemas/common';
import { schema } from '$lib/objects/schemas/types';

const BooleanControl = Type.Boolean();
const NumberControl = Type.Number();

const toggleMessages = {
  booleanControl: schema(BooleanControl),
  numberControl: schema(NumberControl)
};

export class ToggleObject implements TextObjectV2 {
  static type = 'toggle';
  static category = 'interface';
  static description = 'A toggle button that sends true/false when clicked';
  static tags = ['interface', 'control', 'switch', 'boolean', 'input'];

  static inlets: ObjectInlet[] = [
    {
      name: 'value',
      type: 'bool',
      description: 'Control messages',
      defaultValue: false,
      messages: [
        { schema: Bang, description: 'Flip the toggle state' },
        { schema: BooleanControl, description: 'Set the toggle state' },
        { schema: NumberControl, description: 'Set on for values greater than or equal to 1' }
      ],
      handle: { handleType: 'message' }
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'message',
      type: 'bool',
      description: 'Toggle output',
      messages: [{ schema: Type.Boolean(), description: 'Current state' }],
      handle: { handleType: 'message' }
    }
  ];

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {}

  onMessage(data: unknown, meta: MessageMeta): void {
    const inletName = meta.inletName ?? 'value';

    match([inletName, data])
      .with(['value', messages.bang], () => {
        this.setAndSend(!this.getValue());
      })
      .with(['value', toggleMessages.booleanControl], ([, value]) => {
        this.setAndSend(value);
      })
      .with(['value', toggleMessages.numberControl], ([, value]) => {
        this.setAndSend(value >= 1);
      })
      .otherwise(() => {});
  }

  private getValue(): boolean {
    return this.context.getParam('value') === true;
  }

  private setAndSend(value: boolean): void {
    this.context.setParam('value', value, { notifyUI: true });
    this.context.send(value);
  }
}
