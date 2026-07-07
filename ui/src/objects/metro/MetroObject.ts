import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import type { TextObjectV2, MessageMeta } from '$lib/objects/v2/interfaces/text-objects';
import { Type } from '@sinclair/typebox';
import { match, P } from 'ts-pattern';
import { Bang, Start, Stop, messages } from '$lib/objects/schemas/common';
import { schema } from '$lib/objects/schemas/types';

const BooleanControl = Type.Boolean();
const metroMessages = {
  booleanControl: schema(BooleanControl)
};

/**
 * MetroObject sends bang messages at regular intervals.
 */
export class MetroObject implements TextObjectV2 {
  static type = 'metro';
  static category = 'control';
  static description = 'Metronome that sends bang signals at regular intervals';
  static tags = ['control', 'timing', 'metronome', 'clock', 'trigger'];

  static inlets: ObjectInlet[] = [
    {
      name: 'message',
      type: 'message',
      description: 'Control messages',
      messages: [
        { schema: BooleanControl, description: 'True starts the metronome. False stops it.' },
        { schema: Start, description: 'Start the metronome' },
        { schema: Stop, description: 'Stop the metronome' },
        { schema: Bang, description: 'Toggle the metronome' }
      ]
    },
    {
      name: 'interval',
      type: 'int',
      description: 'Interval in milliseconds',
      defaultValue: 1000,
      minNumber: 0
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'out',
      type: 'bang',
      description: 'Bang signal sent at regular intervals',
      messages: [{ schema: Bang, description: 'Sent on each tick' }]
    }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  private intervalId: number | null = null;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  create(): void {
    this.start();
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    match([meta.inletName, data])
      .with(['message', metroMessages.booleanControl], ([, shouldRun]) => {
        if (shouldRun) {
          this.start();
        } else {
          this.stop();
        }
      })
      .with(['message', messages.start], () => this.start())
      .with(['message', messages.stop], () => this.stop())
      .with(['message', messages.bang], () => {
        if (this.intervalId !== null) {
          this.stop();
        } else {
          this.start();
        }
      })
      .with(['interval', P.number], ([, ms]) => {
        this.context.setParam('interval', ms);

        // Restart with new interval
        if (this.intervalId !== null) {
          this.start();
        }
      });
  }

  private start(): void {
    this.stop();

    const intervalMs = this.context.getParam('interval') as number;

    this.intervalId = window.setInterval(() => {
      this.context.send({ type: 'bang' });
    }, intervalMs);
  }

  private stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  destroy(): void {
    this.stop();
  }
}
