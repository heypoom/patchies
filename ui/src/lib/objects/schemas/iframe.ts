import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

// Message schemas for iframe
export const IframeLoad = Type.Object({
  type: Type.Literal('load'),
  url: Type.String()
});
export const IframePostMessage = Type.Unknown(); // Any other message is forwarded via postMessage

/**
 * Schema for the iframe (web embed) object.
 */
export const iframeSchema: ObjectSchema = {
  type: 'iframe',
  category: 'network',
  description: 'Embed external web pages and interactive content',
  inlets: [
    {
      id: 'message',
      description: 'Control and communication messages',
      messages: [
        {
          schema: IframeLoad,
          description: 'Load webpage from URL',
          example: '{type: "load", url: "https://example.com"}'
        },
        {
          schema: IframePostMessage,
          description: 'Any other message is sent to iframe via postMessage'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'postMessage events received from iframe',
      messages: [
        {
          schema: Type.Unknown(),
          description: 'Messages received from iframe via postMessage'
        }
      ]
    }
  ],
  tags: ['web', 'embed', 'external', 'postmessage']
};
