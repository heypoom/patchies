import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';

// Message schemas for iframe
const LoadUrl = msg('load', { url: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const iframeMessages = {
  loadUrl: schema(LoadUrl)
};

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
        { schema: LoadUrl, description: 'Load webpage from URL' },
        { schema: Type.Unknown(), description: 'Other messages forwarded via postMessage' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'postMessage events received from iframe',
      messages: [
        { schema: Type.Unknown(), description: 'Messages received from iframe via postMessage' }
      ]
    }
  ],
  tags: ['web', 'embed', 'external', 'postmessage']
};
