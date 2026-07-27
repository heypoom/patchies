import type { AudioNodeV2, AudioNodeGroup } from '$lib/audio/v2/interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { handleToPortIndex } from '$lib/utils/get-edge-types';

export class MergeNode implements AudioNodeV2 {
  static type = 'merge~';
  static group: AudioNodeGroup = 'processors';
  static runtimeManaged = true;
  static description = 'Merges multiple mono channels into a single multichannel signal';

  static getMessageSettingsUpdate(message: unknown): Record<string, unknown> | null {
    if (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'set-channels' &&
      Number.isInteger((message as { value?: unknown }).value) &&
      (message as { value: number }).value >= 1 &&
      (message as { value: number }).value <= 32
    ) {
      return { channels: (message as { value: number }).value };
    }

    return null;
  }

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
    target: AudioNodeV2,
    _paramName?: string,
    _sourceHandle?: string,
    targetHandle?: string
  ): void {
    if (!target.audioNode) return;

    // For merge~, targetHandle indicates which target input channel to use.
    if (targetHandle) {
      const inputIndex = handleToPortIndex(targetHandle);
      if (inputIndex !== null && !isNaN(inputIndex)) {
        this.audioNode.connect(target.audioNode, 0, inputIndex);
        return;
      }
    }

    this.audioNode.connect(target.audioNode);
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
