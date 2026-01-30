import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';

/**
 * AddNodeV2 implements the +~ audio node.
 * Sums multiple audio signals together.
 */
export class AddNodeV2 implements AudioNodeV2 {
  static type = '+~';
  static group: AudioNodeGroup = 'processors';
  static description = 'Sums multiple audio signals together';

  static inlets: ObjectInlet[] = [
    { name: 'left', type: 'signal' },
    { name: 'right', type: 'signal' }
  ];

  static outlets: ObjectOutlet[] = [{ name: 'out', type: 'signal' }];

  readonly nodeId: string;
  audioNode: GainNode;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioNode = audioContext.createGain();
  }
}
