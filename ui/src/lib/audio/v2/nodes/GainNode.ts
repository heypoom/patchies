import { Type } from '@sinclair/typebox';

import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

/**
 * GainNodeV2 implements the gain~ audio node.
 * Controls the volume/amplitude of an audio signal.
 */
export class GainNodeV2 implements AudioNodeV2 {
  static type = 'gain~';
  static group: AudioNodeGroup = 'processors';
  static description = 'Amplify or attenuate audio signals';
  static tags = ['audio', 'gain', 'volume', 'amplifier'];

  static inlets: ObjectInlet[] = [
    {
      name: 'in',
      type: 'signal',
      description: 'Audio input'
    },
    {
      name: 'gain',
      type: 'float',
      description: 'Gain control',
      defaultValue: 1.0,
      isAudioParam: true,
      maxPrecision: 3,
      messages: [
        {
          schema: Type.Number(),
          description: 'Gain value (1 = unity, >1 = amplify, <1 = attenuate)'
        }
      ]
    }
  ];

  static outlets: ObjectOutlet[] = [{ name: 'out', type: 'signal', description: 'Audio output' }];

  readonly nodeId: string;
  audioNode: GainNode;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioNode = audioContext.createGain();
  }

  create(params: unknown[]): void {
    const [, gainValue] = params as [unknown, number];

    this.audioNode.gain.value = gainValue ?? 1.0;
  }
}
