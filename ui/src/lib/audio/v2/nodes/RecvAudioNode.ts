import { Type } from '@sinclair/typebox';

import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { AudioChannelRegistry } from '$lib/audio/AudioChannelRegistry';

/**
 * RecvAudioNode receives audio from a named channel.
 * Receives audio from all send~ nodes broadcasting on the same channel.
 */
export class RecvAudioNode implements AudioNodeV2 {
  static type = 'recv~';
  static aliases = ['r~'];
  static group: AudioNodeGroup = 'processors';
  static description = 'Receive audio from a named channel';
  static tags = ['audio', 'routing', 'channel', 'wireless'];

  // Channel inlet only - audio comes via virtual edges from send~ nodes
  static inlets: ObjectInlet[] = [
    {
      name: 'channel',
      type: 'string',
      description: 'Channel name',
      defaultValue: 'foo',
      messages: [{ schema: Type.String(), description: 'Channel name' }]
    }
  ];

  static outlets: ObjectOutlet[] = [{ name: 'out', type: 'signal', description: 'Audio output' }];

  readonly nodeId: string;
  audioNode: GainNode;

  private audioContext: AudioContext;
  private channelRegistry: AudioChannelRegistry;
  private currentChannel: string = 'foo';

  constructor(nodeId: string, audioContext: AudioContext) {
    this.nodeId = nodeId;
    this.audioContext = audioContext;
    this.channelRegistry = AudioChannelRegistry.getInstance();

    // Pass-through gain node (unity gain)
    this.audioNode = audioContext.createGain();
    this.audioNode.gain.value = 1.0;
  }

  create(params: unknown[]): void {
    const [channelParam] = params;

    if (typeof channelParam === 'string' && channelParam.length > 0) {
      this.currentChannel = channelParam;
    }

    // Register as receiver on the channel
    this.channelRegistry.subscribe(this.currentChannel, this.nodeId, 'recv');
  }

  send(key: string, message: unknown): void {
    if (key === 'channel' && typeof message === 'string') {
      // Unsubscribe from old channel
      this.channelRegistry.unsubscribe(this.currentChannel, this.nodeId);

      // Subscribe to new channel
      this.currentChannel = message;
      this.channelRegistry.subscribe(this.currentChannel, this.nodeId, 'recv');
    }
  }

  destroy(): void {
    this.channelRegistry.unsubscribe(this.currentChannel, this.nodeId);
    this.audioNode.disconnect();
  }
}
