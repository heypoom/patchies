import { match } from 'ts-pattern';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { sym } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';

export const QueueClear = sym('clear');
export const QueueSize = sym('size');

export const queueCommands = {
  clear: schema(QueueClear),
  size: schema(QueueSize)
};

/**
 * QueueObject is a FIFO (first-in, first-out) message buffer.
 *
 * - Inlet 0: enqueue any message
 * - Inlet 1 (hot): bang → dequeue front item and output; clear → empty queue; size → output count
 */
export class QueueObject implements TextObjectV2 {
  static type = 'queue';
  static description = 'FIFO queue — push messages in, bang to dequeue them out';

  static inlets: ObjectInlet[] = [
    {
      name: 'push',
      type: 'message',
      description: 'Enqueue a message at the back of the queue'
    },
    {
      name: 'cmd',
      type: 'message',
      description: 'Bang to dequeue front item; send clear to empty; send size to get count',
      hot: true,
      messages: [
        { schema: sym('bang'), description: 'Dequeue front item and output' },
        { schema: QueueClear, description: 'Empty the queue' },
        { schema: QueueSize, description: 'Output current queue size' }
      ]
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'out',
      type: 'message',
      description: 'Dequeued item, or size count'
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
              this.context.send(this.items.shift());
            }
          })
          .with(queueCommands.clear, () => {
            this.items = [];
          })
          .with(queueCommands.size, () => {
            this.context.send(this.items.length);
          })
          .otherwise(() => {});
      })
      .otherwise(() => {});
  }
}
