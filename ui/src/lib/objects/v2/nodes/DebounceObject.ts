import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { match } from 'ts-pattern';

/**
 * DebounceObject waits for a quiet period before emitting the last value.
 * Each incoming message resets the timer.
 */
export class DebounceObject implements TextObjectV2 {
  static type = 'debounce';
  static description = 'Waits for quiet period before emitting last value';

  static inlets: ObjectInlet[] = [
    { name: 'message', type: 'message', description: 'Message to debounce' },
    { name: 'time', type: 'int', description: 'Debounce time in ms', defaultValue: 100 }
  ];

  static outlets: ObjectOutlet[] = [{ name: 'out', type: 'message' }];

  readonly nodeId: string;
  readonly context: ObjectContext;

  private pendingTimeout: number | null = null;
  private lastValue: unknown = null;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  onMessage(value: unknown, meta: MessageMeta): void {
    match(meta.inletName)
      .with('message', () => {
        // Store the latest value
        this.lastValue = value;

        // Clear any existing timeout
        if (this.pendingTimeout !== null) {
          clearTimeout(this.pendingTimeout);
        }

        // Set new timeout
        const debounceMs = this.context.getParam('time') as number;
        this.pendingTimeout = window.setTimeout(() => {
          this.context.send(this.lastValue);
          this.pendingTimeout = null;
        }, debounceMs);
      })
      .with('time', () => {
        if (typeof value === 'number') {
          this.context.setParam('time', value);
        }
      });
  }

  destroy(): void {
    if (this.pendingTimeout !== null) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
  }
}
