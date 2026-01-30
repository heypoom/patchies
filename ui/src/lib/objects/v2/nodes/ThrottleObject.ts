import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { match } from 'ts-pattern';

/**
 * ThrottleObject emits immediately, then ignores messages for the throttle period.
 * Like a rate limiter - allows at most one message per time period.
 */
export class ThrottleObject implements TextObjectV2 {
  static type = 'throttle';
  static description = 'Rate limits messages to at most one per time period';

  static inlets: ObjectInlet[] = [
    { name: 'message', type: 'message', description: 'Message to throttle' },
    { name: 'time', type: 'int', description: 'Throttle time in ms', defaultValue: 100 }
  ];

  static outlets: ObjectOutlet[] = [{ name: 'out', type: 'message' }];

  readonly nodeId: string;
  readonly context: ObjectContext;

  private isThrottled = false;
  private throttleTimeout: number | null = null;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  onMessage(value: unknown, meta: MessageMeta): void {
    match(meta.inletName)
      .with('message', () => {
        // If not throttled, emit immediately and start throttle period
        if (!this.isThrottled) {
          this.context.send(value);
          this.isThrottled = true;

          const throttleMs = this.context.getParam('time') as number;
          this.throttleTimeout = window.setTimeout(() => {
            this.isThrottled = false;
            this.throttleTimeout = null;
          }, throttleMs);
        }
        // If throttled, ignore the message
      })
      .with('time', () => {
        if (typeof value === 'number') {
          this.context.setParam('time', value);
        }
      });
  }

  destroy(): void {
    if (this.throttleTimeout !== null) {
      clearTimeout(this.throttleTimeout);
      this.throttleTimeout = null;
    }
    this.isThrottled = false;
  }
}
