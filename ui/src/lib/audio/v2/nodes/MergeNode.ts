import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { handleToPortIndex } from '$lib/utils/get-edge-types';

export class MergeNode implements AudioNodeV2 {
  static type = 'merge~';
  static group: AudioNodeGroup = 'processors';
  static description = 'Merges multiple mono channels into a single multichannel signal';

  static inlets: ObjectInlet[] = [
    {
      name: 'in',
      type: 'signal',
      description: 'Channel inputs (dynamic based on channel count)'
    },
    {
      name: 'channels',
      type: 'int',
      description: 'Number of channels to merge (1-32)',
      defaultValue: 2,
      minNumber: 1,
      maxNumber: 32
    }
  ];

  static outlets: ObjectOutlet[] = [
    { name: 'out', type: 'signal', description: 'Multichannel audio output' }
  ];

  audioNode: ChannelMergerNode;
  readonly nodeId: string;
  private currentChannels: number = 2;

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioNode = audioContext.createChannelMerger(this.currentChannels);
  }

  create(params: unknown[]): void {
    const [, channels] = params as [unknown, number];
    const channelCount = channels ?? 2;

    if (channelCount >= 1 && channelCount <= 32) {
      this.updateChannelCount(channelCount);
    }
  }

  send(key: string, message: unknown): void {
    if (key === 'channels' && typeof message === 'number') {
      this.updateChannelCount(message);
    }
  }

  connect(
    source: AudioNodeV2,
    paramName?: string,
    sourceHandle?: string,
    targetHandle?: string
  ): void {
    if (!source.audioNode) return;

    // For merge~, targetHandle indicates which input channel to connect to
    if (targetHandle) {
      const inputIndex = handleToPortIndex(targetHandle);
      if (inputIndex !== null && !isNaN(inputIndex)) {
        // If source is split~, it already specifies output index, just connect
        source.audioNode.connect(this.audioNode, 0, inputIndex);
        return;
      }
    }

    // Default: connect source to first input
    source.audioNode.connect(this.audioNode);
  }

  private updateChannelCount(newChannels: number): void {
    if (newChannels === this.currentChannels || newChannels < 1 || newChannels > 32) {
      return;
    }

    // Disconnect all existing inputs
    this.audioNode.disconnect();

    // Create new merger with updated channel count
    const audioContext = this.audioNode.context;
    const newMerger = audioContext.createChannelMerger(newChannels);

    // Replace the audio node
    this.audioNode = newMerger;
    this.currentChannels = newChannels;
  }
}
