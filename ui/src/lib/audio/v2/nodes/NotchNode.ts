import { Type } from '@sinclair/typebox';

import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

export class NotchNode implements AudioNodeV2 {
  static type = 'notch~';
  static group: AudioNodeGroup = 'processors';
  static description = 'Notch filter attenuates frequencies around the center frequency';
  static tags = ['audio', 'filter', 'notch', 'eq'];

  static inlets: ObjectInlet[] = [
    {
      name: 'in',
      type: 'signal',
      description: 'Audio input'
    },
    {
      name: 'frequency',
      type: 'float',
      description: 'Center frequency',
      defaultValue: 1000,
      isAudioParam: true,
      minNumber: 0,
      maxNumber: 22050,
      maxPrecision: 1,
      messages: [{ schema: Type.Number(), description: 'Center frequency in Hz' }]
    },
    {
      name: 'Q',
      type: 'float',
      description: 'Width of the notch',
      defaultValue: 1,
      isAudioParam: true,
      minNumber: 0.0001,
      maxNumber: 1000,
      maxPrecision: 2,
      messages: [{ schema: Type.Number(), description: 'Q value' }]
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'out',
      type: 'signal',
      description: 'Filtered audio output'
    }
  ];

  readonly nodeId: string;
  audioNode: BiquadFilterNode;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioNode = audioContext.createBiquadFilter();
    this.audioNode.type = 'notch';
  }

  create(params: unknown[]): void {
    const [, frequency, Q] = params as [unknown, number, number];

    this.audioNode.frequency.value = frequency ?? 1000;
    this.audioNode.Q.value = Q ?? 1;
  }
}
