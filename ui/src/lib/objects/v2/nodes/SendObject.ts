import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { MessageChannelRegistry } from '$lib/messages/MessageChannelRegistry';

/**
 * SendObject broadcasts messages to a named channel.
 * All recv objects listening on the same channel will receive the message.
 */
export class SendObject implements TextObjectV2 {
  static type = 'send';
  static aliases = ['s'];
  static description = 'Send messages to a named channel';
  static tags = ['control', 'routing', 'channel', 'wireless'];

  static inlets: ObjectInlet[] = [
    {
      name: 'message',
      type: 'message',
      description: 'Message to broadcast to channel',
      messages: [{ schema: Type.Any(), description: 'Any message to send' }]
    },
    {
      name: 'channel',
      type: 'string',
      description: 'Channel name to send to',
      defaultValue: 'foo',
      messages: [{ schema: Type.String(), description: 'Channel name' }]
    }
  ];

  // No outlets - send is a sink
  static outlets = [];

  readonly nodeId: string;
  readonly context: ObjectContext;
  private channelRegistry: MessageChannelRegistry;
  private currentChannel: string = '';
  private unsubscribeParamsChange: (() => void) | null = null;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
    this.channelRegistry = MessageChannelRegistry.getInstance();
  }

  private getChannel(): string {
    const channel = this.context.getParam('channel');
    return typeof channel === 'string' && channel.length > 0 ? channel : 'foo';
  }

  create(): void {
    this.registerChannel(this.getChannel());

    this.unsubscribeParamsChange = this.context.onParamsChange(() => {
      const channel = this.getChannel();

      if (channel !== this.currentChannel) {
        this.registerChannel(channel);
      }
    });
  }

  private registerChannel(channel: string): void {
    if (this.currentChannel) {
      this.channelRegistry.unregisterSender(this.currentChannel, this.nodeId);
    }

    this.channelRegistry.registerSender(channel, this.nodeId);
    this.currentChannel = channel;
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    match(meta.inletName)
      .with('message', () => {
        const channel = this.getChannel();
        this.channelRegistry.broadcast(channel, data, this.nodeId);
      })
      .with('channel', () => {
        if (typeof data === 'string' || typeof data === 'number') {
          this.context.setParam('channel', String(data));
        }
      })
      .otherwise(() => {});
  }

  destroy(): void {
    this.unsubscribeParamsChange?.();
    this.unsubscribeParamsChange = null;

    if (this.currentChannel) {
      this.channelRegistry.unregisterSender(this.currentChannel, this.nodeId);
    }

    this.currentChannel = '';
  }
}
