import { Type } from '@sinclair/typebox';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { ChannelRegistry, type MessageChannelCallback } from '$lib/messages/ChannelRegistry';

/**
 * RecvObject receives messages from a named channel.
 * Messages sent via send objects or JS send() with matching channel are forwarded to the outlet.
 */
export class RecvObject implements TextObjectV2 {
  static type = 'recv';
  static aliases = ['r'];
  static description = 'Receive messages from a named channel';
  static tags = ['control', 'routing', 'channel', 'wireless'];

  static inlets: ObjectInlet[] = [
    {
      name: 'channel',
      type: 'string',
      description: 'Channel name to receive from',
      defaultValue: 'foo',
      messages: [{ schema: Type.String(), description: 'Channel name' }]
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'out',
      type: 'message',
      description: 'Messages received from the channel'
    }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;
  private channelRegistry: ChannelRegistry;
  private currentChannel: string = '';
  private channelCallback: MessageChannelCallback;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
    this.channelRegistry = ChannelRegistry.getInstance();

    // Create callback that forwards messages to outlet
    this.channelCallback = (message: unknown) => {
      this.context.send(message);
    };
  }

  create(): void {
    const channel = this.getChannel();
    this.subscribeToChannel(channel);

    // Re-subscribe when channel param changes
    this.context.onParamsChange(() => {
      const newChannel = this.getChannel();
      if (newChannel !== this.currentChannel) {
        this.subscribeToChannel(newChannel);
      }
    });
  }

  private getChannel(): string {
    const channel = this.context.getParam(0);
    return typeof channel === 'string' && channel.length > 0 ? channel : 'foo';
  }

  private subscribeToChannel(channel: string): void {
    // Unsubscribe from old channel
    if (this.currentChannel) {
      this.channelRegistry.unsubscribeMessage(this.currentChannel, this.nodeId);
    }

    // Subscribe to new channel
    this.channelRegistry.subscribeMessage(channel, this.nodeId, this.channelCallback);
    this.currentChannel = channel;
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    if (meta.inletName === 'channel') {
      if (typeof data === 'string' || typeof data === 'number') {
        this.context.setParam(0, String(data));
      }
    }
  }

  destroy(): void {
    if (this.currentChannel) {
      this.channelRegistry.unsubscribeMessage(this.currentChannel, this.nodeId);
    }
  }
}
