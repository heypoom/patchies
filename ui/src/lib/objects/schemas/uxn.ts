import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';
import { Bang, messages } from './common';

// Uxn-specific message schemas
const LoadUrl = msg('load', { url: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const uxnMessages = {
  ...messages,
  loadUrl: schema(LoadUrl)
};

/**
 * Schema for the uxn (Uxn virtual machine) object.
 */
export const uxnSchema: ObjectSchema = {
  type: 'uxn',
  category: 'programming',
  description: 'Uxn virtual machine for running Uxntal assembly programs',
  inlets: [
    {
      id: 'message',
      description: 'Control messages',
      messages: [
        { schema: Type.String(), description: 'URL to load ROM, or Uxntal code to assemble' },
        { schema: Bang, description: 'Re-assemble code or reload ROM' },
        {
          schema: Type.Object({ type: Type.Literal('Uint8Array') }),
          description: 'Load ROM from raw binary data'
        },
        { schema: LoadUrl, description: 'Load ROM from URL' }
      ]
    }
  ],
  outlets: [
    {
      id: 'message',
      description: 'Console output',
      messages: [{ schema: Type.String(), description: 'String messages from console device' }]
    }
  ],
  tags: ['programming', 'uxn', 'uxntal', 'assembly', 'virtual-machine'],
  hasDynamicOutlets: true
};
