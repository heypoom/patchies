import { Type } from '@sinclair/typebox';

import type { AudioNodeV2, AudioNodeGroup } from '../interfaces/audio-nodes';
import type { ObjectInlet, ObjectOutlet } from '$lib/objects/v2/object-metadata';
import { AudioChannelRegistry } from '$lib/audio/AudioChannelRegistry';

/**
 * SendAudioNode broadcasts audio to a named channel.
 * All recv~ nodes listening on the same channel will receive the audio signal.
 */
export class SendAudioNode implements AudioNodeV2 {
  static type = 'send~';
  static aliases = ['s~'];
  static group: AudioNodeGroup = 'processors';
  static description = 'Send audio to a named channel';
  static tags = ['audio', 'routing', 'channel', 'wireless'];

  static inlets: ObjectInlet[] = [
    {
      name: 'in',
      type: 'signal',
      description: 'Audio input to broadcast'
    },
    {
      name: 'channel',
      type: 'string',
      description: 'Channel name',
      defaultValue: 'foo',
      messages: [{ schema: Type.String(), description: 'Channel name' }]
    }
  ];

  // No outlets - send~ routes via virtual edges to recv~ nodes
  static outlets: ObjectOutlet[] = [];

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
    const [, channelParam] = params;

    if (typeof channelParam === 'string' && channelParam.length > 0) {
      this.currentChannel = channelParam;
    }

    // Register as sender on the channel
    this.channelRegistry.subscribe(this.currentChannel, this.nodeId, 'send');
  }

  send(key: string, message: unknown): void {
    if (key === 'channel' && typeof message === 'string') {
      // Unsubscribe from old channel
      this.channelRegistry.unsubscribe(this.currentChannel, this.nodeId);

      // Subscribe to new channel
      this.currentChannel = message;
      this.channelRegistry.subscribe(this.currentChannel, this.nodeId, 'send');
    }
  }

  destroy(): void {
    this.channelRegistry.unsubscribe(this.currentChannel, this.nodeId);
    this.audioNode.disconnect();
  }
}
