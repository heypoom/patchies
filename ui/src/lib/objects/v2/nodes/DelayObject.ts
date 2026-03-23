import { match, P } from 'ts-pattern';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { sym } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';
import { Type } from '@sinclair/typebox';

const BangMsg = sym('bang');
const ClearMsg = sym('clear');
const FlushMsg = sym('flush');

const cmdMessages = {
  bang: schema(BangMsg),
  clear: schema(ClearMsg),
  flush: schema(FlushMsg)
};

/**
 * DelayObject delays messages by a specified time.
 * Similar to Pure Data's [pipe].
 *
 * - Inlet 0: message to delay
 * - Inlet 1 (hot): number sets delay; bang re-sends last value; clear cancels pending; flush outputs pending immediately
 * - Inlet 2 (hidden): delay param storage
 */
export class DelayObject implements TextObjectV2 {
  static type = 'delay';
  static description = 'Delays messages by a specified time';

  static inlets: ObjectInlet[] = [
    {
      name: 'message',
      type: 'message',
      description: 'Message to delay'
    },
    {
      name: 'cmd',
      type: 'message',
      hot: true,
      description: 'Set delay time or control pending messages.',
      messages: [
        { schema: Type.Number(), description: 'Set delay time in ms' },
        { schema: BangMsg, description: 'Re-send last received value after delay' },
        { schema: ClearMsg, description: 'Cancel all pending messages' },
        { schema: FlushMsg, description: 'Output all pending messages immediately' }
      ]
    },
    {
      name: 'delay',
      type: 'int',
      description: 'Delay time in ms',
      defaultValue: 1000,
      hideInlet: true,
      hideDocs: true
    }
  ];

  static outlets: ObjectOutlet[] = [{ name: 'out', type: 'message' }];

  readonly nodeId: string;
  readonly context: ObjectContext;

  private pending: Array<{ id: number; value: unknown }> = [];
  private lastValue: unknown = undefined;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  create(params: unknown[]): void {
    if (params.length > 0 && typeof params[0] === 'number') {
      this.context.setParam('delay', params[0]);
    }
  }

  onMessage(value: unknown, meta: MessageMeta): void {
    match(meta.inletName)
      .with('message', () => {
        this.lastValue = value;
        this.schedule(value);
      })
      .with('cmd', () => {
        match(value)
          .with(P.number, (ms) => {
            this.context.setParam('delay', ms, { notifyUI: true });
          })
          .with(cmdMessages.bang, () => {
            this.schedule(this.lastValue);
          })
          .with(cmdMessages.clear, () => {
            this.cancelAll();
          })
          .with(cmdMessages.flush, () => {
            this.flushAll();
          })
          .otherwise(() => {});
      })
      .otherwise(() => {});
  }

  private schedule(value: unknown): void {
    const delayMs = this.context.getParam('delay') as number;
    const entry: { id: number; value: unknown } = { id: 0, value };

    entry.id = window.setTimeout(() => {
      this.context.send(value);
      this.pending = this.pending.filter((p) => p !== entry);
    }, delayMs);

    this.pending.push(entry);
  }

  private cancelAll(): void {
    for (const entry of this.pending) {
      clearTimeout(entry.id);
    }
    this.pending = [];
  }

  private flushAll(): void {
    for (const entry of this.pending) {
      clearTimeout(entry.id);
      this.context.send(entry.value);
    }

    this.pending = [];
  }

  destroy(): void {
    this.cancelAll();
  }
}
