import { AudioService } from '$lib/audio/v2/AudioService';
import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';

export class SamplerateObject implements TextObjectV2 {
  static type = 'samplerate';
  static description = 'Outputs the current audio sample rate in Hz';
  static tags = ['audio', 'info'];

  static inlets: ObjectInlet[] = [
    {
      name: 'trigger',
      type: 'bang',
      description: 'Bang to output current sample rate',
      hot: true
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'float', description: 'Sample rate in Hz' }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    if (
      meta.inletName === 'trigger' &&
      typeof data === 'object' &&
      (data as { type: string })?.type === 'bang'
    ) {
      const sampleRate = AudioService.getInstance().getAudioContext().sampleRate;
      this.context.send(sampleRate);
    }
  }
}
