import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';
import { schema } from './types';
import { msg } from './helpers';
import { Bang, messages } from './common';
import { P } from 'ts-pattern';

// Uxn-specific message schemas
const LoadUrl = msg('load', { url: Type.String() });
const LoadCode = msg('load', { code: Type.String() });

/** Pre-wrapped matchers for use with ts-pattern */
export const uxnMessages = {
  ...messages,
  loadUrl: schema(LoadUrl),
  loadCode: schema(LoadCode),
  // Matchers for primitive types
  string: P.string,
  uint8Array: P.instanceOf(Uint8Array),
  file: P.instanceOf(File)
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
