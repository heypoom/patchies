import { match } from 'ts-pattern';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { sym } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';

export const StackClear = sym('clear');
export const StackSize = sym('size');

export const stackCommands = {
  clear: schema(StackClear),
  size: schema(StackSize)
};

/**
 * StackObject is a LIFO (last-in, first-out) message buffer.
 *
 * - Inlet 0: push any message onto the stack
 * - Inlet 1 (hot): bang → pop top item and output; clear → empty stack; size → output count
 */
export class StackObject implements TextObjectV2 {
  static type = 'stack';
  static description = 'LIFO stack — push messages in, bang to pop them out';

  static inlets: ObjectInlet[] = [
    {
      name: 'push',
      type: 'message',
      description: 'Push a message onto the top of the stack'
    },
    {
      name: 'cmd',
      type: 'message',
      description: 'Bang to pop top item; send clear to empty; send size to get count',
      hot: true,
      messages: [
        { schema: sym('bang'), description: 'Pop top item and output' },
        { schema: StackClear, description: 'Empty the stack' },
        { schema: StackSize, description: 'Output current stack size' }
      ]
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'out',
      type: 'message',
      description: 'Popped item, or size count'
    }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  private items: unknown[] = [];

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    match(meta.inletName)
      .with('push', () => {
        this.items.push(data);
      })
      .with('cmd', () => {
        match(data)
          .with({ type: 'bang' }, () => {
            if (this.items.length > 0) {
              this.context.send(this.items.pop());
            }
          })
          .with(stackCommands.clear, () => {
            this.items = [];
          })
          .with(stackCommands.size, () => {
            this.context.send(this.items.length);
          })
          .otherwise(() => {});
      })
      .otherwise(() => {});
  }
}
