import { Transport } from '$lib/transport';
import { LookaheadClockScheduler } from '$lib/transport/ClockScheduler';
import type { ObjectContext } from '../ObjectContext';
import type { ObjectOutlet } from '../object-metadata';
import type { TextObjectV2 } from '../interfaces/text-objects';

export class BeatObject implements TextObjectV2 {
  static type = 'beat';
  static description = 'Outputs the current beat on each beat change';
  static tags = ['timing', 'transport', 'control'];

  static inlets = [];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'int', description: 'Current beat in measure (0 to beatsPerBar-1)' }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  private scheduler: LookaheadClockScheduler;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;

    this.scheduler = new LookaheadClockScheduler(() => ({
      time: Transport.seconds,
      beat: Transport.beat,
      bpm: Transport.bpm
    }));
  }

  create(): void {
    this.scheduler.onBeat('*', () => {
      this.context.send(Transport.beat);
    });

    this.scheduler.start();
  }

  destroy(): void {
    this.scheduler.dispose();
  }
}
