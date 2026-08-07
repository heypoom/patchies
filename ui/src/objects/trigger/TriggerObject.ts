import { Type } from '@sinclair/typebox';

import { getTypedOutput, normalizeMessageType } from '$lib/messages/message-types';
import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta, TextObjectV2 } from '$lib/objects/v2/interfaces/text-objects';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export type TriggerData = {
  types?: unknown;
  shorthand?: unknown;
};

export class TriggerObject implements TextObjectV2 {
  static type = 'trigger';
  static category = 'control';
  static description = 'Outputs messages through multiple outlets in right-to-left order';
  static tags = ['flow', 'routing', 'bang', 'sequence'];
  static hasDynamicOutlets = true;

  static handlePatterns = {
    outlet: {
      template: 'message-out-{index}',
      handleType: 'message' as const,
      description: 'One indexed message outlet per type specifier'
    }
  };

  static inlets: ObjectInlet[] = [
    {
      name: 'message',
      type: 'message',
      description: 'Any message triggers all outputs in right-to-left order',
      messages: [{ schema: Type.Any(), description: 'Any input message' }],
      handle: { handleType: 'message' }
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'dynamic',
      type: 'message',
      description: 'Outlets are created based on type specifiers (e.g., "trigger b b n")',
      messages: [{ schema: Type.Any(), description: 'Output selected by the type specifier' }],
      handle: { handleType: 'message' }
    }
  ];

  constructor(
    readonly nodeId: string,
    readonly context: ObjectContext
  ) {}

  onMessage(message: unknown, meta: MessageMeta): void {
    if (meta.inlet !== undefined && meta.inlet !== 0) return;

    const types = this.getTypes();

    for (let index = types.length - 1; index >= 0; index--) {
      const type = normalizeMessageType(types[index]);
      if (!type) continue;

      const output = getTypedOutput(type, message);

      if (output !== undefined) {
        this.context.send(output, { to: index });
      }
    }
  }

  getOutlets(): ObjectOutlet[] {
    return this.getTypes().map((type, index) => ({
      ...TriggerObject.outlets[0],
      name: type,
      handle: { handleType: 'message', handleId: index }
    }));
  }

  private getTypes(): string[] {
    const types = this.context.getData<TriggerData>().types;

    return Array.isArray(types)
      ? types.filter((type): type is string => typeof type === 'string')
      : [];
  }
}
