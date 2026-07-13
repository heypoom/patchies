import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta, TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { schema } from '$lib/objects/schemas/types';

const BooleanValue = Type.Boolean();

const switchMessages = {
  booleanValue: schema(BooleanValue)
};

export class SwitchObject implements TextObjectV2 {
  static type = 'switch';
  static category = 'interface';
  static description = 'A horizontal switch that sends true/false when toggled';
  static tags = ['interface', 'control', 'switch', 'boolean', 'input'];

  static inlets: ObjectInlet[] = [];

  static outlets: ObjectOutlet[] = [
    {
      name: 'message',
      type: 'bool',
      description: 'Switch output',
      messages: [{ schema: BooleanValue, description: 'Current state' }],
      handle: { handleType: 'message' }
    }
  ];

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {}

  onMessage(data: unknown, _meta: MessageMeta): void {
    match(data)
      .with(switchMessages.booleanValue, (value) => {
        this.setAndSend(value);
      })
      .otherwise(() => {});
  }

  private setAndSend(value: boolean): void {
    this.context.setData({ value }, { notifyUI: true });
    this.context.send(value);
  }
}
