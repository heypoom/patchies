import { Type } from '@sinclair/typebox';
import type { ObjectSchema } from './types';

/**
 * Schema for the bytebeat~ (algorithmic synthesis) object.
 *
 * Manual override because BytebeatNode.svelte renders handles without
 * handleId (producing 'message-in' / 'audio-out'), but the auto-generator
 * assigns handleId: 0 (producing 'message-in-0' / 'audio-out-0').
 */
export const bytebeatSchema: ObjectSchema = {
  type: 'bytebeat~',
  category: 'audio',
  description: 'Bytebeat algorithmic synthesis',
  inlets: [
    {
      id: 'control',
      type: 'message',
      description: 'Control messages',
      handle: { handleType: 'message' },
      messages: [
        { schema: Type.Object({ type: Type.Literal('play') }), description: 'Start playback' },
        { schema: Type.Object({ type: Type.Literal('stop') }), description: 'Stop and reset t=0' },
        {
          schema: Type.Object({ type: Type.Literal('pause') }),
          description: 'Pause playback (keep t)'
        },
        {
          schema: Type.Object({ type: Type.Literal('bang') }),
          description: 'Evaluate expression and play'
        },
        {
          schema: Type.Object({
            type: Type.Literal('setType'),
            value: Type.Union([
              Type.Literal('bytebeat'),
              Type.Literal('floatbeat'),
              Type.Literal('signedBytebeat')
            ])
          }),
          description: 'Set bytebeat type'
        },
        {
          schema: Type.Object({
            type: Type.Literal('setSyntax'),
            value: Type.Union([
              Type.Literal('infix'),
              Type.Literal('postfix'),
              Type.Literal('glitch'),
              Type.Literal('function')
            ])
          }),
          description: 'Set expression syntax'
        },
        {
          schema: Type.Object({ type: Type.Literal('setSampleRate'), value: Type.Number() }),
          description: 'Set sample rate'
        }
      ]
    }
  ],
  outlets: [
    {
      id: 'audio',
      type: 'signal',
      description: 'Audio output',
      handle: { handleType: 'audio' }
    }
  ],
  tags: ['audio', 'generator', 'synthesis', 'algorithmic', 'bytebeat']
};
